import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";
import { requireSaasAccess } from "@/lib/saas";

type RouteContext = {
  params: Promise<{
    vin: string;
  }>;
};

type HistoryEvent = {
  id: string;
  event_date: string | null;
  event_type: "THEFT" | "ODOMETER" | "OTHER";
  description: string | null;
  location: string | null;
  odometer: number | null;
  source: string;
  created_at: string;
};

type CreateHistoryEventBody = {
  eventType: "THEFT" | "ODOMETER";
  eventDate?: string | null;
  description?: string | null;
  location?: string | null;
  odometer?: number | null;
};

const HISTORY_COLUMNS = `
  id,
  event_date,
  event_type,
  description,
  location,
  odometer,
  source,
  created_at
`;

function normalizeVin(value: string) {
  return value.trim().toUpperCase();
}

function isValidVin(vin: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

/**
 * GET /api/history/:vin
 *
 * Loads saved history for a vehicle.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { vin } = await params;
    const normalizedVin = normalizeVin(vin);

    if (!isValidVin(normalizedVin)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid VIN format.",
          vin: normalizedVin,
        },
        { status: 400 }
      );
    }

    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in to a dealership first.",
        },
        { status: 401 }
      );
    }

    const supabase =
      await createSupabaseServerClient();

    /*
     * Find the vehicle only inside the
     * currently logged-in dealership.
     *
     * limit(1) prevents PGRST116 if an old
     * duplicate VIN exists.
     */
    const {
      data: vehicleRows,
      error: vehicleError,
    } = await supabase
      .from("vehicles")
      .select("id, dealership_id, vin")
      .eq("vin", normalizedVin)
      .eq(
        "dealership_id",
        profile.dealership_id
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1);

    if (vehicleError) {
      console.error(
        "Supabase vehicle lookup (history) error:",
        vehicleError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            vehicleError.message ||
            "Failed to load vehicle history.",
        },
        { status: 500 }
      );
    }

    const vehicle =
      vehicleRows?.[0] ?? null;

    /*
     * Vehicle has not been saved yet.
     */
    if (!vehicle) {
      return NextResponse.json(
        {
          success: true,
          status: "VEHICLE_NOT_SAVED",
          theft: [],
          odometer: [],
          odometerAnomaly: false,
        },
        { status: 200 }
      );
    }

    /*
     * Load history belonging to this vehicle.
     */
    const {
      data: events,
      error: eventsError,
    } = await supabase
      .from("history_events")
      .select(HISTORY_COLUMNS)
      .eq("vehicle_id", vehicle.id)
      .order("event_date", {
        ascending: true,
        nullsFirst: false,
      });

    if (eventsError) {
      console.error(
        "Supabase history_events error:",
        eventsError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            eventsError.message ||
            "Failed to load vehicle history.",
        },
        { status: 500 }
      );
    }

    const rows =
      (events ?? []) as HistoryEvent[];

    const theft = rows.filter(
      (event) =>
        event.event_type === "THEFT"
    );

    const odometer = rows.filter(
      (event) =>
        event.event_type === "ODOMETER"
    );

    const odometerAnomaly =
      detectOdometerAnomaly(odometer);

    return NextResponse.json(
      {
        success: true,
        status: "CHECKED",
        theft,
        odometer,
        odometerAnomaly,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "History GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error.",
      },
      { status: 500 }
    );
  }
}

/**
 * Detects possible odometer rollback.
 *
 * This is only a warning flag.
 * It does NOT conclude fraud.
 */
function detectOdometerAnomaly(
  odometerEvents: HistoryEvent[]
): boolean {
  const dated = odometerEvents
    .filter(
      (event) =>
        Boolean(event.event_date) &&
        event.odometer !== null &&
        Number.isFinite(
          Number(event.odometer)
        )
    )
    .sort(
      (a, b) =>
        new Date(
          a.event_date as string
        ).getTime() -
        new Date(
          b.event_date as string
        ).getTime()
    );

  for (
    let i = 1;
    i < dated.length;
    i++
  ) {
    const previous = Number(
      dated[i - 1].odometer
    );

    const current = Number(
      dated[i].odometer
    );

    if (current < previous) {
      return true;
    }
  }

  return false;
}

/**
 * POST /api/history/:vin
 *
 * Creates a manual dealership history record.
 */
export async function POST(
  request: Request,
  { params }: RouteContext
) {
  try {
    /*
     * 1. Require logged-in dealership user.
     */
    const profile =
      await getCurrentUserProfile();

    if (
      !profile?.id ||
      !profile.dealership_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Sign in to a dealership first.",
        },
        { status: 401 }
      );
    }

    /*
     * 2. Require active SaaS access.
     */
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

    /*
     * 3. Normalize and validate VIN.
     */
    const { vin } = await params;
    const normalizedVin =
      normalizeVin(vin);

    if (!isValidVin(normalizedVin)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid VIN format.",
          vin: normalizedVin,
        },
        { status: 400 }
      );
    }

    /*
     * 3. Parse JSON.
     */
    let body: CreateHistoryEventBody;

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

    /*
     * 4. Validate event type.
     */
    if (
      body.eventType !== "THEFT" &&
      body.eventType !== "ODOMETER"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "eventType must be THEFT or ODOMETER.",
        },
        { status: 400 }
      );
    }

    /*
     * 5. Validate odometer.
     */
    let odometer: number | null =
      null;

    if (
      body.eventType === "ODOMETER"
    ) {
      if (
        body.odometer === null ||
        body.odometer === undefined
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Odometer events require an odometer value.",
          },
          { status: 400 }
        );
      }

      odometer = Number(
        body.odometer
      );

      if (
        !Number.isFinite(odometer) ||
        odometer < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Odometer must be a valid non-negative number.",
          },
          { status: 400 }
        );
      }
    }

    /*
     * 6. Validate date.
     */
    let eventDate: string | null =
      null;

    if (
      typeof body.eventDate ===
        "string" &&
      body.eventDate.trim()
    ) {
      const date =
        body.eventDate.trim();

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          date
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid event date. Use YYYY-MM-DD.",
          },
          { status: 400 }
        );
      }

      eventDate = date;
    }

    /*
     * 7. Clean optional fields.
     *
     * Location is optional.
     * It is NOT required for odometer records.
     */
    const description =
      typeof body.description ===
        "string" &&
      body.description.trim()
        ? body.description.trim()
        : null;

    const location =
      typeof body.location ===
        "string" &&
      body.location.trim()
        ? body.location.trim()
        : null;

    /*
     * 8. Create Supabase client.
     */
    const supabase =
      await createSupabaseServerClient();

    /*
     * 9. Find vehicle belonging to
     *    current dealership.
     *
     * limit(1) prevents PGRST116.
     */
    const {
      data: vehicleRows,
      error: vehicleError,
    } = await supabase
      .from("vehicles")
      .select(
        "id, dealership_id, vin"
      )
      .eq("vin", normalizedVin)
      .eq(
        "dealership_id",
        profile.dealership_id
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1);

    if (vehicleError) {
      console.error(
        "Supabase vehicle lookup for history insert:",
        vehicleError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            vehicleError.message ||
            "Failed to find vehicle.",
        },
        { status: 500 }
      );
    }

    const vehicle =
      vehicleRows?.[0] ?? null;

    if (!vehicle) {
      console.error(
        "SHIFTLY HISTORY VEHICLE NOT FOUND:",
        {
          vin: normalizedVin,
          dealershipId:
            profile.dealership_id,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Vehicle not found for this dealership. Look it up first.",
        },
        { status: 404 }
      );
    }

    /*
     * 10. Insert history record.
     */
    const insertPayload = {
      vehicle_id: vehicle.id,
      event_date: eventDate,
      event_type: body.eventType,
      description,
      location,
      odometer,
      source: "Manual Entry (Dealer)",
    };

    console.log(
      "Creating history event:",
      insertPayload
    );

    const {
      data: inserted,
      error: insertError,
    } = await supabase
      .from("history_events")
      .insert(insertPayload)
      .select(HISTORY_COLUMNS)
      .single();

    /*
     * 11. Return actual Supabase error.
     */
    if (insertError) {
      console.error(
        "Supabase history event insert error:",
        {
          message:
            insertError.message,
          details:
            insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            insertError.message ||
            "Failed to save history record.",
          details:
            insertError.details || null,
          hint:
            insertError.hint || null,
          code:
            insertError.code || null,
        },
        { status: 500 }
      );
    }

    if (!inserted) {
      return NextResponse.json(
        {
          success: false,
          error:
            "History record was not created.",
        },
        { status: 500 }
      );
    }

    /*
     * 12. Success.
     */
    return NextResponse.json(
      {
        success: true,
        event: inserted,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "History POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error.",
      },
      { status: 500 }
    );
  }
}