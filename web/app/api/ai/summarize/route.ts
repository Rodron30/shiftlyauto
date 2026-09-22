import { NextResponse } from "next/server";

import { callPerplexity } from "@/lib/perplexity";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

import {
  checkRateLimit,
  getRateLimitKey,
} from "@/lib/rateLimit";

import {
  getSaasLimit,
  getSaasLimitError,
  requireSaasAccess,
} from "@/lib/saas";

type VehicleInput = {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
};
type HistoryEventInput = {
  event_date: string | null;
  description: string | null;
  location: string | null;
  odometer: number | null;
  source: string;
};

type SummarizeRequestBody = {
  vehicle: VehicleInput;
  mileageUnit?: string | null;
  history: {
    theft: HistoryEventInput[];
    odometer: HistoryEventInput[];
    accident: HistoryEventInput[];
    claim: HistoryEventInput[];
  };
  vehicleId?: string | null;
  odometerAnomaly?: boolean;
};



type AiSummary = {
  quick_summary: string;
  salesperson_explanation: string;
  customer_summary: string;
  warnings: string[];
  facts: string[];
};

/**
 * ============================================================
 * SYSTEM PROMPT
 * ============================================================
 *
 * The AI is only allowed to explain the structured input.
 * It must never add facts that are not present.
 */
const SYSTEM_PROMPT = `
You are the AI Analysis layer of a dealership vehicle-history tool.

You will receive ONLY structured JSON containing:

1. vehicle information
2. mileageUnit
3. theft-related history
4. odometer history
5. accident history
6. insurance claim history

Your job is to explain ONLY those supplied facts.

IMPORTANT:
The supplied data is the complete source of truth for this response.

STRICT SOURCE-GROUNDING RULES:

1. NEVER invent facts.

2. NEVER add a date that does not literally appear in the supplied JSON.

3. NEVER add a location that does not literally appear in the supplied JSON.

4. NEVER add a number that does not come from the supplied JSON.

5. ODOMETER UNIT:
   Use the supplied mileageUnit to describe odometer values.
   If mileageUnit is "MI", describe odometer values as miles or mi.
   If mileageUnit is "KM", describe odometer values as kilometers or km.
   NEVER convert miles to kilometers or kilometers to miles.
   NEVER use a unit different from the supplied mileageUnit.

6. HISTORY CATEGORIES:
   Theft, odometer, accident, and insurance claim records may be described
   when they are explicitly present in the supplied JSON.
   Describe them only as supplied records.

7. Do not infer damage, collisions, rollovers, repairs,
   registration events, ownership history, title status, or insurance status.

8. Do not infer fraud, odometer rollback, tampering, or misconduct.
   If the supplied data shows a decreasing odometer sequence, say only that
   it may warrant further review.

10. "No record found in the available data" is NOT the same as "clean",
    "safe", or "confirmed clear".

11. Manual Entry means the record was manually entered by the dealer.
    Do not upgrade Manual Entry to Confirmed or Verified.

12. Source Confirmed means exactly that the source field says
    "Source Confirmed". Do not invent another verification method.

13. Preserve the distinction between:
    - source-confirmed records
    - manual entries
    - missing information

14. Do not mention information outside the supplied JSON.

15. Do not mention California, Philippines, United States, or any other
    location unless that exact location is present in the supplied JSON.

16. Do not convert dates to dates that were not supplied.

17. Do not create new odometer readings.

18. Keep the language calm, professional, factual, and easy to understand.

19. The customer summary must be understandable to a normal vehicle buyer.

20. Do not mention that you are an AI unless the supplied UI requires it.

OUTPUT:

Return ONLY valid JSON.

Use exactly this structure:

{
  "quick_summary": string,
  "salesperson_explanation": string,
  "customer_summary": string,
  "warnings": string[],
  "facts": string[]
}

Do not use markdown.
Do not use code fences.
Do not add commentary outside the JSON.
`;

/**
 * ============================================================
 * NORMALIZATION HELPERS
 * ============================================================
 */

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForComparison(
  value: string
): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Escape regex special characters.
 */
function escapeRegExp(
  value: string
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

/**
 * Extract only facts that actually exist in the input.
 */
function buildSourceFacts(
  body: SummarizeRequestBody
) {
  const theft = body.history.theft ?? [];
  const odometer = body.history.odometer ?? [];
  const accident = body.history.accident ?? [];
  const claim = body.history.claim ?? [];

  const dates = new Set<string>();
  const locations = new Set<string>();
  const descriptions = new Set<string>();
  const sources = new Set<string>();
  const odometerValues = new Set<number>();

  for (const event of [
    ...theft,
    ...odometer,
    ...accident,
    ...claim,
  ]) {
    if (event.event_date) {
      dates.add(
        normalizeText(event.event_date)
      );
    }

    if (event.location) {
      locations.add(
        normalizeText(event.location)
      );
    }

    if (event.description) {
      descriptions.add(
        normalizeText(event.description)
      );
    }

    if (event.source) {
      sources.add(
        normalizeText(event.source)
      );
    }

    if (
      typeof event.odometer ===
        "number" &&
      Number.isFinite(event.odometer)
    ) {
      odometerValues.add(
        event.odometer
      );
    }
  }

  return {
    dates: [...dates],
    locations: [...locations],
    descriptions: [...descriptions],
    sources: [...sources],
    odometerValues: [
      ...odometerValues,
    ],
    mileageUnit: body.mileageUnit ?? null,
    historyCounts: {
      theft: theft.length,
      odometer: odometer.length,
      accident: accident.length,
      claim: claim.length,
    },
  };
}

/**
 * ============================================================
 * DETERMINISTIC FALLBACK
 * ============================================================
 *
 * This fallback does not use AI and therefore cannot hallucinate.
 */
function buildFallbackSummary(
  body: SummarizeRequestBody
): AiSummary {
  const theft = body.history.theft ?? [];
  const odometer = body.history.odometer ?? [];
  const accident = body.history.accident ?? [];
  const claim = body.history.claim ?? [];

  const hasTheft = theft.length > 0;
  const hasOdometer = odometer.length > 0;
  const hasAccident = accident.length > 0;
  const hasClaim = claim.length > 0;

  const unit =
    String(body.mileageUnit ?? "KM").toUpperCase() === "MI"
      ? "MI"
      : "KM";

  const unitLabel = unit === "MI" ? "miles" : "kilometers";

  const sortedOdometer =
    [...odometer]
      .filter(
        (event) =>
          typeof event.odometer === "number" &&
          Number.isFinite(event.odometer)
      )
      .sort((a, b) => {
        const aDate = a.event_date || "";
        const bDate = b.event_date || "";

        return aDate.localeCompare(bDate);
      });

  const first = sortedOdometer[0]?.odometer;
  const last =
    sortedOdometer[sortedOdometer.length - 1]?.odometer;

  const historyParts: string[] = [];

  if (hasTheft) {
    historyParts.push(
      `${theft.length} theft-related record${
        theft.length === 1 ? "" : "s"
      }`
    );
  }

  if (hasOdometer) {
    historyParts.push(
      `${odometer.length} odometer record${
        odometer.length === 1 ? "" : "s"
      }`
    );
  }

  if (hasAccident) {
    historyParts.push(
      `${accident.length} accident record${
        accident.length === 1 ? "" : "s"
      }`
    );
  }

  if (hasClaim) {
    historyParts.push(
      `${claim.length} insurance claim record${
        claim.length === 1 ? "" : "s"
      }`
    );
  }

  const quickSummary =
    historyParts.length > 0
      ? `The available history includes ${historyParts.join(" and ")}.`
      : "No theft-related, odometer, accident, or insurance claim records were found in the available data.";

  const odometerRange =
    first != null && last != null
      ? `, ranging from ${first.toLocaleString("en-US")} ${unit} to ${last.toLocaleString("en-US")} ${unit}`
      : "";

  const salespersonParts: string[] = [];

  if (hasTheft) {
    salespersonParts.push(
      `The available data contains ${theft.length} theft-related record${
        theft.length === 1 ? "" : "s"
      }.`
    );
  }

  if (hasOdometer) {
    salespersonParts.push(
      `The available odometer history contains ${odometer.length} reading${
        odometer.length === 1 ? "" : "s"
      }${odometerRange}.`
    );
  }

  if (hasAccident) {
    salespersonParts.push(
      `The available data contains ${accident.length} accident record${
        accident.length === 1 ? "" : "s"
      }.`
    );
  }

  if (hasClaim) {
    salespersonParts.push(
      `The available data contains ${claim.length} insurance claim record${
        claim.length === 1 ? "" : "s"
      }.`
    );
  }

  const salespersonExplanation =
    salespersonParts.length > 0
      ? salespersonParts.join(" ")
      : "No theft-related, odometer, accident, or insurance claim records were found in the available data.";

  const customerSummaryParts: string[] = [];

  if (hasTheft) {
    customerSummaryParts.push(
      `The available vehicle-history data includes a theft-related record${
        theft.length === 1 ? "" : "s"
      }.`
    );
  }

  if (hasOdometer) {
    customerSummaryParts.push(
      `Odometer records are available and shown in ${unitLabel}.`
    );
  }

  if (hasAccident) {
    customerSummaryParts.push(
      `The available data includes ${accident.length} accident record${
        accident.length === 1 ? "" : "s"
      }.`
    );
  }

  if (hasClaim) {
    customerSummaryParts.push(
      `The available data includes ${claim.length} insurance claim record${
        claim.length === 1 ? "" : "s"
      }.`
    );
  }

  const customerSummary =
    customerSummaryParts.length > 0
      ? customerSummaryParts.join(" ")
      : "No theft-related, odometer, accident, or insurance claim records were found in the available data.";

  const warnings: string[] = [];

  if (hasTheft) {
    warnings.push(
      "A theft-related record is present in the available data."
    );
  }

  if (hasAccident) {
    warnings.push(
      "An accident record is present in the available data."
    );
  }

  if (hasClaim) {
    warnings.push(
      "An insurance claim record is present in the available data."
    );
  }

  if (body.odometerAnomaly) {
    warnings.push(
      "The available odometer records show an inconsistency that may warrant further review."
    );
  }

  if (hasOdometer) {
    warnings.push(
      "The odometer information is based only on the records provided."
    );
  }

  return {
    quick_summary: quickSummary,
    salesperson_explanation: salespersonExplanation,
    customer_summary: customerSummary,
    warnings,
    facts: [
      hasTheft
        ? "Theft-related record found in the available data."
        : "No theft-related record was found in the available data.",
      hasOdometer
        ? `Odometer records are available and measured in ${unitLabel}.`
        : "No odometer records are available.",
      hasAccident
        ? "Accident record found in the available data."
        : "No accident record was found in the available data.",
      hasClaim
        ? "Insurance claim record found in the available data."
        : "No insurance claim record was found in the available data.",
    ],
  };
}

/**
 * ============================================================
 * FORBIDDEN / UNSUPPORTED CONTENT
 * ============================================================
 */

const FORBIDDEN_PATTERNS: {
  pattern: RegExp;
  label: string;
}[] = [
  {
    pattern: /\baccident(s)?\b/i,
    label: "accident",
  },
  {
    pattern: /\brollover(s)?\b/i,
    label: "rollover",
  },
  {
    pattern: /\bregistration\b/i,
    label: "registration",
  },
  {
    pattern: /\bcollision(s)?\b/i,
    label: "collision",
  },
  {
    pattern: /\bcrash(ed|es)?\b/i,
    label: "crash",
  },
  {
    pattern: /\brepair(s|ed)?\b/i,
    label: "repair",
  },
  {
    pattern: /\bdamage(d)?\b/i,
    label: "damage",
  },
  {
    pattern: /\btitle\b/i,
    label: "title status",
  },
  {
    pattern: /\binsurance\b/i,
    label: "insurance",
  },
  {
    pattern: /\bowner(ship)?\b/i,
    label: "ownership",
  },
  {
    pattern: /\bclean title\b/i,
    label: "clean title",
  },
  {
    pattern: /\bsafe\b/i,
    label: "safety conclusion",
  },
  {
    pattern: /\bconfirmed clean\b/i,
    label: "confirmed clean",
  },
  {
    pattern: /\bno issues\b/i,
    label: "unsupported no-issues claim",
  },
  {
    pattern: /\bfraud\b/i,
    label: "fraud conclusion",
  },
  {
    pattern: /\btamper(ed|ing)?\b/i,
    label: "tampering conclusion",
  },
  {
    pattern: /\brollback\b/i,
    label: "rollback conclusion",
  },
  {
    pattern: /\$\s?\d/,
    label: "dollar amount",
  },

  // Mileage must always remain km.
  {
    pattern: /\bmiles?\b/i,
    label: "miles unit",
  },
  {
    pattern: /\bmi\b/i,
    label: "mi unit",
  },
];

/**
 * ============================================================
 * UNSUPPORTED FACT DETECTION
 * ============================================================
 */

/**
 * Check whether AI introduced a location that was not supplied.
 *
 * We specifically block common geographic phrases because the
 * previous response incorrectly introduced "California".
 */
const UNSUPPORTED_LOCATION_PATTERNS: RegExp[] = [
  /\bCalifornia\b/i,
  /\bTexas\b/i,
  /\bFlorida\b/i,
  /\bNew York\b/i,
  /\bLos Angeles\b/i,
  /\bSan Francisco\b/i,
  /\bPhilippines\b/i,
  /\bUnited States\b/i,
  /\bUSA\b/i,
  /\bU\.S\.\b/i,
];

/**
 * Detect whether a date-looking value is present.
 */
const DATE_PATTERN =
  /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;

/**
 * Detect numeric values that could represent odometer
 * readings or other invented quantities.
 */
const NUMBER_PATTERN =
  /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d{4,}\b/g;

/**
 * Check whether a piece of AI text contains unsupported
 * dates, locations, or odometer values.
 */
function findUnsupportedFacts(
  text: string,
  sourceFacts: ReturnType<
    typeof buildSourceFacts
  >
): string[] {
  const violations: string[] = [];

  const normalizedText =
    normalizeForComparison(text);

  // ----------------------------------------------------------
  // Unsupported locations
  // ----------------------------------------------------------

  for (const pattern of UNSUPPORTED_LOCATION_PATTERNS) {
    const match =
      normalizedText.match(
        pattern
      );

    if (!match) {
      continue;
    }

    const suppliedLocation =
      sourceFacts.locations.some(
        (location) =>
          normalizedText.includes(
            normalizeForComparison(
              location
            )
          )
      );

    if (!suppliedLocation) {
      violations.push(
        `unsupported location: ${match[0]}`
      );
    }
  }

  // ----------------------------------------------------------
  // Unsupported dates
  // ----------------------------------------------------------

  const datesInText =
    text.match(DATE_PATTERN) ?? [];

  for (const date of datesInText) {
    const supplied =
      sourceFacts.dates.some(
        (sourceDate) =>
          sourceDate.includes(date) ||
          date.includes(sourceDate)
      );

    if (!supplied) {
      violations.push(
        `unsupported date: ${date}`
      );
    }
  }

  // ----------------------------------------------------------
  // Unsupported odometer values
  // ----------------------------------------------------------

  const numbersInText =
    text.match(NUMBER_PATTERN) ?? [];

  for (const rawNumber of numbersInText) {
    const numericValue =
      Number(
        rawNumber.replace(
          /,/g,
          ""
        )
      );

    if (
      !Number.isFinite(
        numericValue
      )
    ) {
      continue;
    }

    /*
     * Only treat numbers that exactly match a supplied
     * odometer value as valid odometer facts.
     *
     * Other small numbers such as vehicle year are ignored.
     */
    const looksLikeOdometer =
      numericValue >= 1000;

    if (!looksLikeOdometer) {
      continue;
    }

    const supplied =
      sourceFacts.odometerValues.includes(
        numericValue
      );

    const isVehicleYear =
      bodyYearIs(
        numericValue,
        sourceFacts
      );

    if (
      !supplied &&
      !isVehicleYear
    ) {
      violations.push(
        `unsupported numeric value: ${rawNumber}`
      );
    }
  }

  return violations;
}

/**
 * Vehicle years are legitimate facts from vehicle input,
 * so they must not be mistaken for invented odometer values.
 */
function bodyYearIs(
  value: number,
  _sourceFacts: ReturnType<
    typeof buildSourceFacts
  >
): boolean {
  return (
    value >= 1900 &&
    value <= 2100
  );
}

/**
 * ============================================================
 * FACT CHECK
 * ============================================================
 */

function factCheck(
  output: AiSummary,
  body: SummarizeRequestBody
): {
  output: AiSummary;
  violations: string[];
} {
  const violations: string[] = [];

  const sourceFacts =
    buildSourceFacts(body);

  const cleaned: AiSummary = {
    quick_summary:
      normalizeText(
        output.quick_summary
      ),

    salesperson_explanation:
      normalizeText(
        output.salesperson_explanation
      ),

    customer_summary:
      normalizeText(
        output.customer_summary
      ),

    warnings: Array.isArray(
      output.warnings
    )
      ? output.warnings
          .map(normalizeText)
          .filter(Boolean)
      : [],

    facts: Array.isArray(
      output.facts
    )
      ? output.facts
          .map(normalizeText)
          .filter(Boolean)
      : [],
  };

  const textFields: (
    | "quick_summary"
    | "salesperson_explanation"
    | "customer_summary"
  )[] = [
    "quick_summary",
    "salesperson_explanation",
    "customer_summary",
  ];

  // ----------------------------------------------------------
  // Check AI narrative fields
  // ----------------------------------------------------------

  // Forbidden topics
  // Allow terms that are explicitly supported by supplied history/unit data.
  const hasAccidentHistory =
    (body.history.accident ?? []).length > 0;

  const hasClaimHistory =
    (body.history.claim ?? []).length > 0;

  const mileageUnit =
    String(body.mileageUnit ?? "KM").toUpperCase();

  const effectiveForbiddenPatterns =
    FORBIDDEN_PATTERNS.filter((item) => {
      if (item.label === "accident") {
        return !hasAccidentHistory;
      }

      if (item.label === "insurance") {
        return !hasClaimHistory;
      }

      if (
        item.label === "miles unit" ||
        item.label === "mi unit"
      ) {
        return mileageUnit !== "MI";
      }

      return true;
    });

  for (const field of textFields) {
    const text =
      cleaned[field];

    // Forbidden topics
    // Allow terms that are explicitly supported by supplied history/unit data.

    const forbidden =
      effectiveForbiddenPatterns.find(
        (item) =>
          item.pattern.test(
            text
          )
      );

    if (forbidden) {
      violations.push(
        `${field}: ${forbidden.label}`
      );

      cleaned[field] =
        field ===
        "customer_summary"
          ? "A summary could not be safely generated from the supplied vehicle-history data. Please review the available records directly."
          : "This explanation was replaced by the fact-check step because it contained unsupported information. Please review the supplied history records directly.";
    }

    // Unsupported dates, locations, and values
    const unsupported =
      findUnsupportedFacts(
        text,
        sourceFacts
      );

    if (
      unsupported.length > 0
    ) {
      violations.push(
        `${field}: ${unsupported.join(
          ", "
        )}`
      );

      cleaned[field] =
        field ===
        "customer_summary"
          ? "The available vehicle-history records are shown above. Please review those records directly for the source details."
          : "The generated explanation contained source details that could not be verified against the supplied records and was therefore replaced by the fact-check step.";
    }
  }

  // ----------------------------------------------------------
  // Check warnings
  // ----------------------------------------------------------

  cleaned.warnings =
    cleaned.warnings.filter(
      (warning) => {
        const forbidden =
          effectiveForbiddenPatterns.some(
            (item) =>
              item.pattern.test(
                warning
              )
          );

        if (forbidden) {
          violations.push(
            `warning: forbidden content`
          );

          return false;
        }

        const unsupported =
          findUnsupportedFacts(
            warning,
            sourceFacts
          );

        if (
          unsupported.length > 0
        ) {
          violations.push(
            `warning: ${unsupported.join(
              ", "
            )}`
          );

          return false;
        }

        return true;
      }
    );

  // ----------------------------------------------------------
  // Check facts
  // ----------------------------------------------------------

  cleaned.facts =
    cleaned.facts.filter(
      (fact) => {
        const forbidden =
          effectiveForbiddenPatterns.some(
            (item) =>
              item.pattern.test(
                fact
              )
          );

        if (forbidden) {
          violations.push(
            "fact: forbidden content"
          );

          return false;
        }

        const unsupported =
          findUnsupportedFacts(
            fact,
            sourceFacts
          );

        if (
          unsupported.length > 0
        ) {
          violations.push(
            `fact: ${unsupported.join(
              ", "
            )}`
          );

          return false;
        }

        return true;
      }
    );

  return {
    output: cleaned,
    violations,
  };
}

/**
 * ============================================================
 * POST
 * ============================================================
 */

export async function POST(
  request: Request
) {
  /**
   * Rate-limit AI requests before doing
   * expensive work.
   */
  const profile =
    await getCurrentUserProfile();

  const rateLimitKey =
    getRateLimitKey(
      request,
      profile?.id
    );

  const { allowed } =
    checkRateLimit(
      rateLimitKey,
      20,
      60_000
    );

  if (!allowed) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Too many requests. Please wait a moment and try again.",
      },
      {
        status: 429,
      }
    );
  }

  // ----------------------------------------------------------
  // Parse request
  // ----------------------------------------------------------

  let body: SummarizeRequestBody;

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Invalid JSON body.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !body?.vehicle ||
    !body?.history
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Missing vehicle or history in request.",
      },
      {
        status: 400,
      }
    );
  }

  const structuredInput = {
    vehicle: body.vehicle,
    mileageUnit: body.mileageUnit ?? null,

    history: {
      theft:
        body.history.theft ??
        [],

      odometer:
        body.history.odometer ??
        [],

      accident:
        body.history.accident ??
        [],

      claim:
        body.history.claim ??
        [],
    },
  };

  let aiOutput: AiSummary;

  let rawContent = "";

  // ----------------------------------------------------------
  // SaaS AI usage enforcement
  // ----------------------------------------------------------

  const saasAccess = await requireSaasAccess();

  if (!saasAccess.ok) {
    return NextResponse.json(
      { error: saasAccess.error },
      { status: saasAccess.status }
    );
  }

  const aiRequestLimit =
    getSaasLimit(
      saasAccess.context.plan,
      "ai_requests"
    );

  const supabase =
    await createSupabaseServerClient();

  const {
    data: usageReserved,
    error: usageReserveError,
  } = await supabase.rpc(
    "saas_reserve_usage",
    {
      p_dealership_id:
        saasAccess.context.dealershipId,
      p_usage_key:
        "ai_requests",
      p_amount: 1,
    }
  );

  if (usageReserveError) {
    console.error(
      "SaaS AI usage reservation error:",
      usageReserveError
    );

    return NextResponse.json(
      {
        error:
          "Unable to verify AI usage allowance.",
      },
      { status: 500 }
    );
  }

  if (usageReserved !== true) {
    return NextResponse.json(
      {
        error:
          aiRequestLimit !== null
            ? getSaasLimitError(
                "Monthly AI request",
                aiRequestLimit
              )
            : "AI request limit reached.",
      },
      { status: 403 }
    );
  }

  let aiProviderSucceeded = false;

  // ----------------------------------------------------------
  // AI generation
  // ----------------------------------------------------------

  try {
    rawContent =
      await callPerplexity([
        {
          role: "system",
          content:
            SYSTEM_PROMPT,
        },

        {
          role: "user",
          content:
            JSON.stringify(
              structuredInput,
              null,
              2
            ),
        },
      ]);

    // The external provider call succeeded. From this point onward,
    // the AI request has been consumed even if parsing or validation
    // later falls back to the deterministic summary.
    aiProviderSucceeded = true;

    let cleaned =
      rawContent.trim();

    /**
     * Remove optional markdown fences.
     */
    cleaned =
      cleaned.replace(
        /^```json\s*/i,
        ""
      );

    cleaned =
      cleaned.replace(
        /^```\s*/i,
        ""
      );

    cleaned =
      cleaned.replace(
        /\s*```$/i,
        ""
      );

    const parsed =
      JSON.parse(cleaned);

    aiOutput = {
      quick_summary:
        String(
          parsed.quick_summary ??
            ""
        ),

      salesperson_explanation:
        String(
          parsed.salesperson_explanation ??
            ""
        ),

      customer_summary:
        String(
          parsed.customer_summary ??
            ""
        ),

      warnings:
        Array.isArray(
          parsed.warnings
        )
          ? parsed.warnings.map(
              String
            )
          : [],

      facts:
        Array.isArray(
          parsed.facts
        )
          ? parsed.facts.map(
              String
            )
          : [],
    };
  } catch (error) {
    console.error(
      "Perplexity AI summarize error:",
      error
    );

    if (!aiProviderSucceeded) {
      const {
        error: usageReleaseError,
      } = await supabase.rpc(
        "saas_release_usage",
        {
          p_dealership_id:
            saasAccess.context.dealershipId,
          p_usage_key:
            "ai_requests",
          p_amount: 1,
        }
      );

      if (usageReleaseError) {
        console.error(
          "SaaS AI usage release error:",
          usageReleaseError
        );
      }
    }

    aiOutput =
      buildFallbackSummary(
        body
      );
  }

  // ----------------------------------------------------------
  // Deterministic fact-check
  // ----------------------------------------------------------

  const checked =
    factCheck(
      aiOutput,
      body
    );

  aiOutput =
    checked.output;

  const violations =
    checked.violations;

  /**
   * If the AI contained unsupported information,
   * replace the entire AI response with the
   * deterministic source-grounded fallback.
   *
   * This is stronger than simply deleting a word.
   */
  if (
    violations.length > 0
  ) {
    console.warn(
      "AI summary fact-check violations:",
      violations
    );

    aiOutput =
      buildFallbackSummary(
        body
      );
  }

  // ----------------------------------------------------------
  // Deterministic odometer warning
  // ----------------------------------------------------------

  if (
    body.odometerAnomaly
  ) {
    const alreadyMentioned =
      aiOutput.warnings.some(
        (warning) =>
          /odometer/i.test(
            warning
          )
      );

    if (
      !alreadyMentioned
    ) {
      aiOutput = {
        ...aiOutput,

        warnings: [
          ...aiOutput.warnings,

          "The available odometer records show an inconsistency that may warrant further review.",
        ],
      };
    }
  }

  // ----------------------------------------------------------
  // Final unit enforcement
  // ----------------------------------------------------------

  /**
   * Final odometer-unit enforcement must follow the vehicle's
   * supplied mileageUnit. Never convert between units.
   */
  const finalText = [
    aiOutput.quick_summary,
    aiOutput.salesperson_explanation,
    aiOutput.customer_summary,
    ...aiOutput.warnings,
    ...aiOutput.facts,
  ].join(" ");

  const finalMileageUnit =
    String(body.mileageUnit ?? "KM").toUpperCase();

  const invalidFinalUnit =
    finalMileageUnit === "MI"
      ? false
      : /\bmiles?\b|\bmi\b/i.test(finalText);

  if (invalidFinalUnit) {
    console.warn(
      "Final AI output contained an invalid odometer unit. Using deterministic fallback."
    );

    aiOutput =
      buildFallbackSummary(
        body
      );

    if (
      body.odometerAnomaly
    ) {
      aiOutput = {
        ...aiOutput,

        warnings: [
          ...aiOutput.warnings,
          "The available odometer records show an inconsistency that may warrant further review.",
        ],
      };
    }
  }

  // ----------------------------------------------------------
  // Audit log
  // ----------------------------------------------------------

  if (body.vehicleId) {
    try {
      const supabase =
        await createSupabaseServerClient();

      await supabase
        .from("ai_analysis")
        .insert({
          vehicle_id:
            body.vehicleId,

          input_data:
            structuredInput,

          ai_output: {
            ...aiOutput,

            raw:
              rawContent ||
              null,

            factCheckViolations:
              violations,
          },

          model:
            "perplexity/sonar",
        });
    } catch (auditError) {
      /**
       * Audit logging must never block
       * the customer-facing AI response.
       */
      console.error(
        "ai_analysis audit log error:",
        auditError
      );
    }
  }

  // ----------------------------------------------------------
  // Response
  // ----------------------------------------------------------

  return NextResponse.json(
    {
      success: true,
      summary: aiOutput,
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}
