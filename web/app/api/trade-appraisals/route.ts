import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

const ALLOWED_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR"] as const;

type Condition = (typeof ALLOWED_CONDITIONS)[number];

const DEFAULT_DEDUCTION: Record<Condition, number> = {
  EXCELLENT: 10,
  GOOD: 15,
  FAIR: 20,
  POOR: 30,
};

const WHOLESALE_FACTOR: Record<Condition, number> = {
  EXCELLENT: 0.85,
  GOOD: 0.80,
  FAIR: 0.72,
  POOR: 0.60,
};

type ComparableVehicle = {
  year: number | null;
  mileage: number | null;
  price: number | null;
};

async function calculateHistoryScore(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  dealershipId: string,
  vin: string | null
) {
  if (!vin) {
    return 100;
  }

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id")
    .eq("dealership_id", dealershipId)
    .eq("vin", vin)
    .is("archived_at", null)
    .maybeSingle();

  if (vehicleError || !vehicle) {
    return 100;
  }

  const { data: history, error: historyError } = await supabase
    .from("history_events")
    .select("event_type, odometer")
    .eq("vehicle_id", vehicle.id)
    .order("event_date", { ascending: true });

  if (historyError) {
    console.error("Appraisal history lookup error:", historyError);
    return 100;
  }

  const events = history ?? [];

  const theftCount = events.filter(
    (event) => event.event_type === "THEFT"
  ).length;

  const odometerRecords = events
    .filter(
      (event) =>
        event.event_type === "ODOMETER" &&
        event.odometer !== null &&
        Number.isFinite(Number(event.odometer))
    )
    .map((event) => Number(event.odometer));

  let odometerAnomaly = false;

  for (let i = 1; i < odometerRecords.length; i += 1) {
    if (odometerRecords[i] < odometerRecords[i - 1]) {
      odometerAnomaly = true;
      break;
    }
  }

  let score = 100;

  if (theftCount > 0) {
    score -= 50;
  }

  if (odometerAnomaly) {
    score -= 30;
  }

  return Math.max(0, Math.min(100, score));
}

async function estimateMarketValue(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  dealershipId: string,
  input: {
    year: number | null;
    make: string;
    model: string;
    mileage: number | null;
  }
) {
  let query = supabase
    .from("vehicles")
    .select("year, mileage, price")
    .eq("dealership_id", dealershipId)
    .is("archived_at", null)
    .ilike("make", input.make)
    .ilike("model", input.model)
    .not("price", "is", null)
    .limit(100);

  if (input.year !== null) {
    query = query
      .gte("year", input.year - 2)
      .lte("year", input.year + 2);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Appraisal comparable lookup error:", error);
    return null;
  }

  const vehicles = (data ?? []) as ComparableVehicle[];

  const validVehicles = vehicles.filter(
    (vehicle) =>
      vehicle.price !== null &&
      Number.isFinite(Number(vehicle.price)) &&
      Number(vehicle.price) > 0
  );

  if (validVehicles.length === 0) {
    return null;
  }

  const ranked = validVehicles
    .map((vehicle) => {
      const yearDistance =
        input.year !== null && vehicle.year !== null
          ? Math.abs(input.year - vehicle.year)
          : 0;

      const mileageDistance =
        input.mileage !== null && vehicle.mileage !== null
          ? Math.abs(input.mileage - vehicle.mileage)
          : 0;

      return {
        price: Number(vehicle.price),
        distance: yearDistance * 100000 + mileageDistance,
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 20);

  const prices = ranked
    .map((vehicle) => vehicle.price)
    .sort((a, b) => a - b);

  const middle = Math.floor(prices.length / 2);

  const median =
    prices.length % 2 === 0
      ? (prices[middle - 1] + prices[middle]) / 2
      : prices[middle];

  return Math.round(median * 100) / 100;
}

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        { success: false, error: "Sign in to a dealership first." },
        { status: 401 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("trade_appraisals")
      .select(
        [
          "id",
          "vin",
          "year",
          "make",
          "model",
          "trim",
          "mileage",
          "condition",
          "market_value",
          "deduction_percent",
          "appraised_value",
          "history_score",
          "wholesale_estimate",
          "retail_estimate",
          "notes",
          "created_at",
        ].join(", ")
      )
      .eq("dealership_id", profile.dealership_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Trade appraisals GET error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load trade appraisals.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        appraisals: data ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Trade appraisals GET API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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

    let body: {
      vin?: string;
      year?: number | string;
      make?: string;
      model?: string;
      trim?: string;
      mileage?: number | string;
      condition?: string;
      marketValue?: number | string;
      deductionPercent?: number | string;
      notes?: string;
    };

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

    const make = String(body.make ?? "").trim();
    const model = String(body.model ?? "").trim();

    if (!make || !model) {
      return NextResponse.json(
        {
          success: false,
          error: "Make and model are required.",
        },
        { status: 400 }
      );
    }

    const conditionValue = String(body.condition ?? "GOOD").toUpperCase();

    if (!ALLOWED_CONDITIONS.includes(conditionValue as Condition)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid condition. Use EXCELLENT, GOOD, FAIR, or POOR.",
        },
        { status: 400 }
      );
    }

    const condition = conditionValue as Condition;

    const year =
      body.year === undefined || body.year === ""
        ? null
        : Number(body.year);

    if (
      year !== null &&
      (!Number.isInteger(year) || year < 1900 || year > 2100)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid year.",
        },
        { status: 400 }
      );
    }

    const mileage =
      body.mileage === undefined || body.mileage === ""
        ? null
        : Number(String(body.mileage).replace(/,/g, ""));

    if (
      mileage !== null &&
      (!Number.isFinite(mileage) || mileage < 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid mileage.",
        },
        { status: 400 }
      );
    }

    const vin = String(body.vin ?? "").trim().toUpperCase() || null;

    if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "VIN must be exactly 17 valid characters, or left blank.",
        },
        { status: 400 }
      );
    }

    const manualMarketValue =
      body.marketValue === undefined || body.marketValue === ""
        ? null
        : Number(String(body.marketValue).replace(/,/g, ""));

    if (
      manualMarketValue !== null &&
      (!Number.isFinite(manualMarketValue) || manualMarketValue <= 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid market value.",
        },
        { status: 400 }
      );
    }

    const deductionPercent =
      body.deductionPercent === undefined ||
      body.deductionPercent === ""
        ? DEFAULT_DEDUCTION[condition]
        : Number(body.deductionPercent);

    if (
      !Number.isFinite(deductionPercent) ||
      deductionPercent < 0 ||
      deductionPercent > 100
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Deduction percent must be between 0 and 100.",
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    let marketValue = manualMarketValue;
    let marketValueSource = "Manual Entry (Dealer)";

    if (marketValue === null) {
      const estimatedValue = await estimateMarketValue(
        supabase,
        profile.dealership_id,
        {
          year,
          make,
          model,
          mileage,
        }
      );

      if (estimatedValue === null) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No comparable inventory was found. Enter a market value manually.",
          },
          { status: 400 }
        );
      }

      marketValue = estimatedValue;
      marketValueSource = "Comparable Dealer Inventory";
    }

    const historyScore = await calculateHistoryScore(
      supabase,
      profile.dealership_id,
      vin
    );

    const retailEstimate =
      Math.round(marketValue * 100) / 100;

    const historyAdjustment =
      0.85 + (historyScore / 100) * 0.15;

    const wholesaleEstimate =
      Math.round(
        marketValue *
          WHOLESALE_FACTOR[condition] *
          historyAdjustment *
          100
      ) / 100;

    const appraisedValue =
      Math.round(
        marketValue * (1 - deductionPercent / 100) * 100
      ) / 100;

    const { data: appraisal, error } = await supabase
      .from("trade_appraisals")
      .insert({
        dealership_id: profile.dealership_id,
        vin,
        year,
        make,
        model,
        trim: body.trim?.trim() || null,
        mileage,
        condition,
        market_value: marketValue,
        deduction_percent: deductionPercent,
        appraised_value: appraisedValue,
        history_score: historyScore,
        wholesale_estimate: wholesaleEstimate,
        retail_estimate: retailEstimate,
        notes: body.notes?.trim() || null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Trade appraisal insert error:", error);

      return NextResponse.json(
        {
          success: false,
          error:
            error.message ||
            "Failed to save trade appraisal.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        appraisal,
        valuation: {
          marketValue,
          marketValueSource,
          historyScore,
          wholesaleEstimate,
          retailEstimate,
          appraisedValue,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Trade appraisal POST error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}
