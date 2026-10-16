import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { decodeVin } from "@/lib/vinDecode";
import { checkRateLimit, getClientIdentifier } from "@/lib/bcautoloan/rateLimit";

const ALLOWED_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR"] as const;

type Condition = (typeof ALLOWED_CONDITIONS)[number];

const WHOLESALE_FACTOR: Record<Condition, number> = {
  EXCELLENT: 0.85,
  GOOD: 0.80,
  FAIR: 0.72,
  POOR: 0.60,
};

function normalizeVin(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function isValidVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

function normalizePostalCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function isValidPostalCode(postalCode: string): boolean {
  return /^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/.test(postalCode);
}

function normalizeMileage(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const mileage = Number(String(value).replace(/,/g, ""));

  if (!Number.isFinite(mileage) || mileage < 0) {
    return null;
  }

  return Math.round(mileage);
}

async function estimateMarketValue(
  dealershipId: string,
  input: {
    year: number | null;
    make: string;
    model: string;
    mileage: number | null;
  }
) {
  const supabase = createSupabaseAdminClient();

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
    console.error("BCAutoLoan comparable lookup error:", error);
    return null;
  }

  const vehicles = (data ?? []).filter((vehicle) => {
    const price = Number(vehicle.price);
    return Number.isFinite(price) && price > 0;
  });

  if (vehicles.length === 0) {
    return null;
  }

  const ranked = vehicles
    .map((vehicle) => {
      const yearDistance =
        input.year !== null && vehicle.year !== null
          ? Math.abs(input.year - Number(vehicle.year))
          : 0;

      const mileageDistance =
        input.mileage !== null && vehicle.mileage !== null
          ? Math.abs(input.mileage - Number(vehicle.mileage))
          : 0;

      return {
        price: Number(vehicle.price),
        distance: yearDistance * 100000 + mileageDistance,
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 20);

  if (ranked.length === 0) {
    return null;
  }

  const prices = ranked.map((vehicle) => vehicle.price).sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);

  const marketValue =
    prices.length % 2 === 0
      ? (prices[middle - 1] + prices[middle]) / 2
      : prices[middle];

  return {
    marketValue: Math.round(marketValue * 100) / 100,
    comparableCount: ranked.length,
  };
}

export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);

    if (!identifier) {
      return NextResponse.json(
        {
          success: false,
          error: "We couldn't verify your request. Please try again shortly.",
        },
        { status: 503 }
      );
    }

    const rateLimit = await checkRateLimit(identifier, "sell-car");

    if (rateLimit.error) {
      console.error("[SellCarOffer] Rate limit service unavailable:", rateLimit.error);
      return NextResponse.json(
        {
          success: false,
          error: "The offer service is temporarily unavailable. Please try again shortly.",
        },
        { status: 503 }
      );
    }

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests. Please try again later.",
        },
        { status: 429 }
      );
    }

    const body = await request.json();

    if (body?.honeypot) {
      return NextResponse.json({
        success: true,
        message: "Offer request received.",
      });
    }

    const vin = normalizeVin(body?.vin);
    const postalCode = normalizePostalCode(body?.postalCode);
    const mileage = normalizeMileage(body?.mileage);
    const condition = String(body?.condition ?? "GOOD").toUpperCase() as Condition;

    if (!isValidVin(vin)) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid 17-character VIN.",
        },
        { status: 400 }
      );
    }

    if (!isValidPostalCode(postalCode)) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid Canadian postal code.",
        },
        { status: 400 }
      );
    }

    if (mileage === null) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter the vehicle mileage.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_CONDITIONS.includes(condition)) {
      return NextResponse.json(
        {
          success: false,
          error: "Please select a valid vehicle condition.",
        },
        { status: 400 }
      );
    }

    const dealershipId = process.env.BCAUTOLOAN_DEALERSHIP_ID;

    if (!dealershipId) {
      console.error("BCAUTOLOAN_DEALERSHIP_ID is not configured.");

      return NextResponse.json(
        {
          success: false,
          error: "Vehicle valuation is temporarily unavailable.",
        },
        { status: 503 }
      );
    }

    const decoded = await decodeVin(vin);

    if (!decoded?.make || !decoded?.model) {
      return NextResponse.json(
        {
          success: false,
          error:
            "We couldn't verify this VIN. Please check the VIN and try again.",
        },
        { status: 400 }
      );
    }

    const valuation = await estimateMarketValue(dealershipId, {
      year: decoded.year,
      make: decoded.make,
      model: decoded.model,
      mileage,
    });

    if (!valuation) {
      return NextResponse.json(
        {
          success: false,
          error:
            "We couldn't find enough comparable vehicles to calculate a reliable offer for this vehicle.",
        },
        { status: 422 }
      );
    }

    const offer = Math.round(
      valuation.marketValue * WHOLESALE_FACTOR[condition] * 100
    ) / 100;

    return NextResponse.json({
      success: true,
      vehicle: {
        year: decoded.year,
        make: decoded.make,
        model: decoded.model,
        trim: decoded.trim,
        body: decoded.body,
        engine: decoded.engine,
        drivetrain: decoded.drivetrain,
        fuel: decoded.fuel,
      },
      valuation: {
        offer,
        marketValue: valuation.marketValue,
        comparableCount: valuation.comparableCount,
        source: "Comparable Dealer Inventory",
        postalCode,
      },
    });
  } catch (error) {
    console.error("BCAutoLoan sell-car offer error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to calculate an offer right now.",
      },
      { status: 500 }
    );
  }
}

