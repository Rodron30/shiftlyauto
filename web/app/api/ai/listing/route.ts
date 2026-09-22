import { NextResponse } from "next/server";

import { callPerplexity } from "@/lib/perplexity";
import { convertToCAD } from "@/lib/currency";
import {
  checkRateLimit,
  getRateLimitKey,
} from "@/lib/rateLimit";
import { 
  createSupabaseServerClient,
  getCurrentUserProfile 
} from "@/lib/supabaseServer";
import {
  getSaasLimit,
  requireSaasAccess,
} from "@/lib/saas";

type ListingVehicle = {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  body: string | null;
  engine: string | null;
  drivetrain: string | null;
  transmission: string | null;
  fuel: string | null;
  price: number | null;
  currency: string | null;
  mileage: number | null;
  mileageUnit: string | null;
  location: string | null;
  description: string | null;
  images?: string[];
};

type ListingRequestBody = {
  vehicle: ListingVehicle;
};

type FacebookListing = {
  title: string;
  description: string;
  price_cad: number | null;
  mileage_km: number | null;
  images?: string[];
};

const SYSTEM_PROMPT = `
You create clean, factual Facebook Marketplace vehicle listings.

The supplied JSON is the complete and only source of truth.

STRICT RULES:
1. Never invent vehicle facts.
2. Use ONLY facts explicitly supplied in the JSON.
3. Price is ALWAYS CAD.
4. Mileage is ALWAYS KM.
5. Never mention USD, PHP, miles, or MI.
6. Do not invent features, options, accident history, ownership history, financing, warranty, condition, availability, or payment terms.
7. Do not add dealer promotions, rebates, discounts, incentives, documentation fees, destination fees, taxes, or other fees unless the user explicitly provides a separate field specifically intended for the Facebook listing.
8. Ignore promotional or fee language contained inside the vehicle description.
9. Do not copy raw dealer marketing text.
10. Do not use words or facts that are not directly supported by the structured vehicle fields.
11. Do not describe a vehicle as "new", "used", "clean", "excellent", "like new", or similar unless explicitly provided.
12. Do not add exterior/interior colors unless explicitly supplied.
13. Keep the title short and factual. Preferred format:
    [year] [make] [model] [trim]
    Add drivetrain only when it is explicitly supplied and useful.
14. Write a concise Marketplace description using only verified vehicle facts.
15. Use natural English. Do not produce awkward phrases such as "in Back".
16. Do not repeat the same fact unnecessarily.
17. Do not include hashtags, emojis, sales slogans, calls to action, or contact information.
18. Return ONLY valid JSON matching this exact structure:

{
  "title": "string",
  "description": "string",
  "price_cad": number or null,
  "mileage_km": number or null
}

Before returning the JSON, silently verify:
- Every vehicle fact in the title exists in the input.
- Every vehicle fact in the description exists in the input.
- Price is CAD.
- Mileage is KM.
- No dealer promotion or fee text was copied.
`;

export async function POST(request: Request) {
  // Temporary diagnostics to identify auth issue
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  console.log("[AI LISTING DIAGNOSTIC] authUserExists:", !!user);
  console.log("[AI LISTING DIAGNOSTIC] authUserId:", user?.id || null);
  console.log("[AI LISTING DIAGNOSTIC] authError:", !!authError);
  if (authError) {
    console.log("[AI LISTING DIAGNOSTIC] authErrorMessage:", authError.message);
  }
  
  console.log("[AI LISTING DIAGNOSTIC] Calling getCurrentUserProfile()...");
  const profile = await getCurrentUserProfile();
  
  console.log("[AI LISTING DIAGNOSTIC] getCurrentUserProfile completed");
  console.log("[AI LISTING DIAGNOSTIC] profileExists:", !!profile);
  console.log("[AI LISTING DIAGNOSTIC] profileId:", profile?.id || null);
  console.log("[AI LISTING DIAGNOSTIC] profileDealershipId:", profile?.dealership_id || null);
  console.log("[AI LISTING DIAGNOSTIC] Known admin ID: 874cd102-0d6c-4fdc-a83a-98f8069c69a7");
  console.log("[AI LISTING DIAGNOSTIC] Known manager ID: 1922b3cb-c981-45d0-962e-358f21c4099a");

  const rateLimitKey = getRateLimitKey(
    request,
    profile?.id
  );

  const { allowed } = checkRateLimit(
    rateLimitKey,
    20,
    60_000
  );

  if (!allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests. Please wait a moment and try again.",
      },
      { status: 429 }
    );
  }

  let body: ListingRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid JSON body.",
      },
      { status: 400 }
    );
  }

  if (!body?.vehicle) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing vehicle in request.",
      },
      { status: 400 }
    );
  }

  console.log("[AI LISTING DIAGNOSTIC] Calling requireSaasAccess()...");
  const saasAccess = await requireSaasAccess();

  console.log("[AI LISTING DIAGNOSTIC] requireSaasAccess completed");
  console.log("[AI LISTING DIAGNOSTIC] saasAccess.ok:", saasAccess.ok);

  if (!saasAccess.ok) {
    console.log("[AI LISTING DIAGNOSTIC] Returning error status:", saasAccess.status, "reason:", saasAccess.error);
  } else {
    console.log("[AI LISTING DIAGNOSTIC] saasAccess.context.plan:", saasAccess.context.plan);
    console.log("[AI LISTING DIAGNOSTIC] saasAccess.context.dealershipId:", saasAccess.context.dealershipId);
  }

  if (!saasAccess.ok) {
    console.log("[AI LISTING DIAGNOSTIC] Returning error status:", saasAccess.status, "reason:", saasAccess.error);
    return NextResponse.json(
      { error: saasAccess.error },
      { status: saasAccess.status }
    );
  }

  const aiRequestLimit = getSaasLimit(
    saasAccess.context.plan,
    "ai_requests"
  );

  if (aiRequestLimit === null || aiRequestLimit <= 0) {
    return NextResponse.json(
      {
        success: false,
        error: "AI requests are not available on this plan.",
      },
      { status: 403 }
    );
  }

  const vehicle = body.vehicle;
  const originalImages = (vehicle as any)?.images || [];

  let priceCad: number | null = null;

  if (vehicle.price !== null) {
    // If already CAD, use directly; otherwise convert
    const currency = String(vehicle.currency || "").toUpperCase();
    if (currency === "CAD") {
      priceCad = vehicle.price;
    } else {
      priceCad = await convertToCAD(
        vehicle.price,
        vehicle.currency
      );

      if (priceCad === null) {
        return NextResponse.json(
          {
            success: false,
            error: "Unable to convert vehicle price to CAD.",
          },
          { status: 400 }
        );
      }
    }
  }

  const mileageKm =
    vehicle.mileage !== null
      ? Number(vehicle.mileage)
      : null;

  const mileageUnit = String(vehicle.mileageUnit || "").toUpperCase();
  
  // Validate that mileage is in KM (should already be normalized from vehicle API)
  if (
    mileageKm !== null &&
    (!Number.isFinite(mileageKm) ||
      mileageUnit !== "KM")
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Vehicle mileage must be normalized to KM before AI listing generation.",
      },
      { status: 400 }
    );
  }

  const structuredInput = {
    vehicle: {
      ...vehicle,
      price: priceCad,
      currency: "CAD",
      mileage: mileageKm,
      mileageUnit: "KM",
    },
  };

  try {
    const rawContent = await callPerplexity(
      [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify(structuredInput),
        },
      ],
      {
        maxTokens: 700,
      }
    );

    let listing: FacebookListing;

    try {
      listing = JSON.parse(rawContent) as FacebookListing;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "AI returned invalid listing JSON.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      listing: {
        ...listing,
        price_cad: priceCad,
        mileage_km: mileageKm,
        images: originalImages,
      },
    });
  } catch (error) {
    console.error("Facebook listing AI error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to generate Facebook Marketplace listing.",
      },
      { status: 500 }
    );
  }
}

