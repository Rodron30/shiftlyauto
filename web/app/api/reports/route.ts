import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";
import { generateShareToken } from "@/lib/shareToken";
import { checkRateLimit, getRateLimitKey } from "@/lib/rateLimit";
import {
  getSaasLimit,
  getSaasLimitError,
  requireSaasAccess,
} from "@/lib/saas";
import type { CustomerReportPayload } from "@/lib/reportTypes";

type HistoryEventInput = {
  event_date: string | null;
  description: string | null;
  location: string | null;
  odometer: number | null;
  source: string;
};

type CreateReportBody = {
  vehicleId: string;
  customerId?: string | null;
  leadId?: string | null;
  aiSummary: {
    quick_summary: string;
    salesperson_explanation: string;
    customer_summary: string;
    warnings: string[];
    facts: string[];
  };
};

const MAX_TOKEN_ATTEMPTS = 5;

export async function POST(request: Request) {
  let body: CreateReportBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!body?.vehicleId || !body?.aiSummary) {
    return NextResponse.json(
      { success: false, error: "Missing vehicleId or aiSummary." },
      { status: 400 }
    );
  }

  const profile = await getCurrentUserProfile();

  if (!profile?.dealership_id) {
    return NextResponse.json(
      {
        success: false,
        error: "You must be signed in to a dealership to create a report.",
      },
      { status: 401 }
    );
  }

  // Customers cannot create reports
  if (profile.role === "customer") {
    return NextResponse.json(
      {
        success: false,
        error: "Customers do not have permission to create reports.",
      },
      { status: 403 }
    );
  }

  const rateLimitKey = getRateLimitKey(request, profile.id);
  const { allowed } = checkRateLimit(rateLimitKey, 30, 60_000);

  if (!allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests. Please wait a moment and try again.",
      },
      { status: 429 }
    );
  }

  const saasAccess = await requireSaasAccess();

  if (!saasAccess.ok) {
    return NextResponse.json(
      {
        success: false,
        error: saasAccess.error,
      },
      { status: saasAccess.status }
    );
  }

  const supabase = await createSupabaseServerClient();


  let customerId = body.customerId ?? null;
  let leadId = body.leadId ?? null;

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id, dealership_id, vin, year, make, model, trim, mileage_unit")
    .eq("id", body.vehicleId)
    .eq("dealership_id", profile.dealership_id)
    .maybeSingle();

  if (vehicleError || !vehicle) {
    return NextResponse.json(
      { success: false, error: "Vehicle not found." },
      { status: 404 }
    );
  }

  if (customerId) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("dealership_id", profile.dealership_id)
      .maybeSingle();

    if (customerError) {
      console.error("Report customer lookup error:", customerError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to validate customer.",
        },
        { status: 500 }
      );
    }

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer not found.",
        },
        { status: 404 }
      );
    }
  }

  if (leadId) {
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, customer_id, vehicle_id")
      .eq("id", leadId)
      .eq("dealership_id", profile.dealership_id)
      .maybeSingle();

    if (leadError) {
      console.error("Report lead lookup error:", leadError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to validate lead.",
        },
        { status: 500 }
      );
    }

    if (!lead) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead not found.",
        },
        { status: 404 }
      );
    }

    if (lead.vehicle_id && lead.vehicle_id !== vehicle.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead is not linked to this vehicle.",
        },
        { status: 400 }
      );
    }

    if (!customerId && lead.customer_id) {
      customerId = lead.customer_id;
    }

    if (
      customerId &&
      lead.customer_id &&
      lead.customer_id !== customerId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead and customer do not match.",
        },
        { status: 400 }
      );
    }
  }

  const { data: dealership } = await supabase
    .from("dealerships")
    .select("name, logo_url")
    .eq("id", vehicle.dealership_id)
    .maybeSingle();

  const { data: events, error: eventsError } = await supabase
    .from("history_events")
    .select(
      "event_date, event_type, description, location, odometer, source"
    )
    .eq("vehicle_id", vehicle.id)
    .order("event_date", { ascending: true });

  if (eventsError) {
    console.error(
      "Report creation history lookup error:",
      eventsError
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load vehicle history.",
      },
      { status: 500 }
    );
  }

  const rows = (events ?? []) as (HistoryEventInput & {
    event_type: "THEFT" | "ODOMETER" | "ACCIDENT" | "CLAIM" | "OTHER";
  })[];

  const theft = rows
    .filter((row) => row.event_type === "THEFT")
    .map((row) => ({
      date: row.event_date,
      description: row.description,
      location: row.location,
      odometer: row.odometer,
      source: row.source,
    }));

  const odometer = rows
    .filter((row) => row.event_type === "ODOMETER")
    .map((row) => ({
      date: row.event_date,
      description: row.description,
      location: row.location,
      odometer: row.odometer,
      source: row.source,
    }));

  const accident = rows
    .filter((row) => row.event_type === "ACCIDENT")
    .map((row) => ({
      date: row.event_date,
      description: row.description,
      location: row.location,
      odometer: row.odometer,
      source: row.source,
    }));

  const claim = rows
    .filter((row) => row.event_type === "CLAIM")
    .map((row) => ({
      date: row.event_date,
      description: row.description,
      location: row.location,
      odometer: row.odometer,
      source: row.source,
    }));


  const uniqueSources = Array.from(
    new Set(rows.map((row) => row.source).filter(Boolean))
  );

  const customerReport: CustomerReportPayload = {
    dealership: {
      name: dealership?.name ?? "Your Dealership",
      logo_url: dealership?.logo_url ?? null,
    },
    vehicle: {
      vin: vehicle.vin,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
    },
    history_highlights: {
      theft_found: theft.length > 0,
      odometer_available: odometer.length > 0,
      accident_found: accident.length > 0,
      claim_found: claim.length > 0,
    },
    theft,
    odometer,
    accident,
    claim,
    mileage_unit: vehicle.mileage_unit ?? null,
    customer_summary: body.aiSummary.customer_summary,
    warnings: body.aiSummary.warnings,
    data_source:
      uniqueSources.length > 0
        ? uniqueSources.join(", ")
        : "N/A",
    generated_at: new Date().toISOString(),
  };

  const reportLimit = getSaasLimit(
    saasAccess.context.plan,
    "reports"
  );

  const {
    data: reportUsageReserved,
    error: reportUsageReserveError,
  } = await supabase.rpc(
    "saas_reserve_usage",
    {
      p_dealership_id:
        saasAccess.context.dealershipId,
      p_usage_key:
        "reports",
      p_amount: 1,
    }
  );

  if (reportUsageReserveError) {
    console.error(
      "SaaS report usage reservation error:",
      reportUsageReserveError
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to verify report usage allowance.",
      },
      { status: 500 }
    );
  }

  if (reportUsageReserved !== true) {
    return NextResponse.json(
      {
        success: false,
        error:
          reportLimit !== null
            ? getSaasLimitError(
                "Monthly report",
                reportLimit
              )
            : "Monthly report limit reached.",
      },
      { status: 403 }
    );
  }

  let lastError: unknown = null;

  for (
    let attempt = 0;
    attempt < MAX_TOKEN_ATTEMPTS;
    attempt++
  ) {
    const shareToken = generateShareToken();

    const { data: inserted, error: insertError } = await supabase
      .from("reports")
      .insert({
        vehicle_id: vehicle.id,
        customer_id: customerId,
        lead_id: leadId,
        created_by: profile.id,
        ai_summary: body.aiSummary,
        customer_report: customerReport,
        source_information: {
          sources: uniqueSources,
          retrieved_at: new Date().toISOString(),
        },
        share_token: shareToken,
      })
      .select("id, share_token, created_at")
      .single();

    if (!insertError && inserted) {
      const { error: activityError } = await supabase
        .from("salesperson_activities")
        .insert({
          dealership_id: profile.dealership_id,
          customer_id: customerId,
          lead_id: leadId,
          user_id: profile.id,
          activity_type: "NOTE",
          description: "Customer report generated.",
          metadata: {
            source: "report_creation",
            report_id: inserted.id,
            vehicle_id: vehicle.id,
          },
        });

      if (activityError) {
        console.error(
          "Report activity logging error:",
          activityError
        );
      }

      return NextResponse.json(
        {
          success: true,
          report: inserted,
        },
        { status: 201 }
      );
    }

    lastError = insertError;

    if (insertError?.code !== "23505") {
      break;
    }
  }

  const {
    error: usageReleaseError,
  } = await supabase.rpc(
    "saas_release_usage",
    {
      p_dealership_id:
        saasAccess.context.dealershipId,
      p_usage_key:
        "reports",
      p_amount: 1,
    }
  );

  if (usageReleaseError) {
    console.error(
      "SaaS report usage release error:",
      usageReleaseError
    );
  }

  console.error("Report creation error:", lastError);

  return NextResponse.json(
    {
      success: false,
      error: "Failed to create report.",
    },
    { status: 500 }
  );
}

export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();

  if (!profile?.dealership_id) {
    return NextResponse.json(
      {
        success: false,
        error: "Sign in to a dealership first.",
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number.parseInt(
    searchParams.get("limit") ?? "",
    10
  );

  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 100)
    : 50;

  const supabase = await createSupabaseServerClient();

  const { data: reports, error } = await supabase
    .from("reports")
    .select(
      `
        id,
        vehicle_id,
        customer_id,
        lead_id,
        created_by,
        share_token,
        created_at,
        customer_report,
        customer:customers(
          id,
          name,
          phone,
          email
        ),
        lead:leads(
          id,
          customer_id,
          customer_name,
          status,
          follow_up_date,
          vehicle_id
        ),
        salesperson:users(
          id,
          name,
          email
        )
      `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Reports list error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load reports.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    reports: reports ?? [],
  });
}




