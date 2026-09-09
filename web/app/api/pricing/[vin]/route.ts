import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

type RouteContext = {
  params: Promise<{
    vin: string;
  }>;
};

function normalizeVin(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function isValidVin(vin: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

type CreateComparableBody = {
  price: number;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  mileage?: number | null;
  location?: string | null;
  sourceUrl?: string | null;
  listedAt?: string | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * POST /api/pricing/:vin
 *
 * Adds a manually-entered competitive comparable listing, then
 * recalculates and saves a fresh pricing analysis from every
 * comparable on file for this vehicle (source = "Manual Entry
 * (Dealer)" — same convention as POST /api/history/:vin until a
 * commercial market-data provider is wired up; see 0008_pricing.sql).
 *
 * The recommended price is the median of comparable prices
 * (market_price). This is intentionally simple for V1 — swap in a
 * smarter model later without changing the response shape GET
 * already expects.
 */
export async function POST(
  request: Request,
  { params }: RouteContext
) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile?.dealership_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in to a dealership first.",
        },
        { status: 401 }
      );
    }

    const { vin } = await params;
    const normalizedVin = normalizeVin(vin);

    if (!isValidVin(normalizedVin)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid VIN format.",
        },
        { status: 400 }
      );
    }

    let body: CreateComparableBody;

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

    const price = Number(body.price);

    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid comparable price.",
        },
        { status: 400 }
      );
    }

    const mileage =
      body.mileage === null || body.mileage === undefined
        ? null
        : Number(body.mileage);

    if (
      mileage !== null &&
      (!Number.isFinite(mileage) || mileage < 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid comparable mileage.",
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Find active vehicle within the user's dealership.
    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id, dealership_id")
      .eq("vin", normalizedVin)
      .eq("dealership_id", profile.dealership_id)
      .is("archived_at", null)
      .maybeSingle();

    if (vehicleError) {
      console.error(
        "Supabase pricing vehicle lookup error:",
        vehicleError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            vehicleError.message || "Failed to load vehicle.",
        },
        { status: 500 }
      );
    }

    if (!vehicle) {
      return NextResponse.json(
        {
          success: false,
          error: "Vehicle not found for this dealership.",
        },
        { status: 404 }
      );
    }

    // 1. Insert the new comparable listing.
    const { error: insertError } = await supabase
      .from("vehicle_market_listings")
      .insert({
        vehicle_id: vehicle.id,
        dealership_id: profile.dealership_id,
        source: "Manual Entry (Dealer)",
        source_url: body.sourceUrl?.trim() || null,
        year: body.year ?? null,
        make: body.make?.trim() || null,
        model: body.model?.trim() || null,
        trim: body.trim?.trim() || null,
        price,
        mileage,
        location: body.location?.trim() || null,
        listed_at: body.listedAt || null,
      });

    if (insertError) {
      console.error(
        "Supabase comparable listing insert error:",
        insertError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            insertError.message ||
            "Failed to save comparable listing.",
        },
        { status: 500 }
      );
    }

    // 2. Recalculate from every comparable on file for this vehicle.
    const { data: comparables, error: comparablesError } =
      await supabase
        .from("vehicle_market_listings")
        .select("price")
        .eq("vehicle_id", vehicle.id)
        .eq("dealership_id", profile.dealership_id)
        .not("price", "is", null);

    if (comparablesError) {
      console.error(
        "Supabase comparables reload error:",
        comparablesError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            comparablesError.message ||
            "Comparable was saved, but pricing could not be recalculated.",
        },
        { status: 500 }
      );
    }

    const prices = (comparables ?? [])
      .map((row) => row.price)
      .filter(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value)
      );

    const lowPrice = prices.length > 0 ? Math.min(...prices) : null;
    const highPrice = prices.length > 0 ? Math.max(...prices) : null;
    const marketPrice = median(prices);

    // 3. Save a fresh analysis row (history-preserving, per 0008_pricing.sql).
    const { data: analysis, error: analysisError } = await supabase
      .from("vehicle_price_analysis")
      .insert({
        vehicle_id: vehicle.id,
        dealership_id: profile.dealership_id,
        low_price: lowPrice,
        market_price: marketPrice,
        high_price: highPrice,
        recommended_price: marketPrice,
        comparable_count: prices.length,
      })
      .select(
        "low_price, market_price, high_price, recommended_price, comparable_count, calculated_at"
      )
      .single();

    if (analysisError) {
      console.error(
        "Supabase price analysis insert error:",
        analysisError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            analysisError.message ||
            "Comparable was saved, but pricing could not be recalculated.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        pricing: analysis,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Pricing POST error:", error);

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
 * GET /api/pricing/:vin
 *
 * Returns pricing analysis, competitive listings,
 * and days on market for the authenticated dealership.
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
        },
        { status: 400 }
      );
    }

    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile?.dealership_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in to a dealership first.",
        },
        { status: 401 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Find active vehicle within the user's dealership.
    const { data: vehicle, error: vehicleError } =
      await supabase
        .from("vehicles")
        .select(
          `
            id,
            dealership_id,
            vin,
            year,
            make,
            model,
            trim,
            price,
            mileage,
            status,
            listed_at,
            archived_at
          `
        )
        .eq("vin", normalizedVin)
        .eq("dealership_id", profile.dealership_id)
        .is("archived_at", null)
        .maybeSingle();

    if (vehicleError) {
      console.error(
        "Supabase pricing vehicle lookup error:",
        vehicleError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            vehicleError.message ||
            "Failed to load vehicle.",
        },
        { status: 500 }
      );
    }

    if (!vehicle) {
      return NextResponse.json(
        {
          success: false,
          error: "Vehicle not found.",
        },
        { status: 404 }
      );
    }

    // Latest saved pricing analysis.
    const { data: analysis, error: analysisError } =
      await supabase
        .from("vehicle_price_analysis")
        .select(
          `
            id,
            market_price,
            low_price,
            high_price,
            recommended_price,
            comparable_count,
            calculated_at
          `
        )
        .eq("vehicle_id", vehicle.id)
        .eq("dealership_id", profile.dealership_id)
        .order("calculated_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (analysisError) {
      console.error(
        "Supabase pricing analysis lookup error:",
        analysisError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            analysisError.message ||
            "Failed to load pricing analysis.",
        },
        { status: 500 }
      );
    }

    // Competitive listings for this vehicle.
    const { data: comparables, error: comparablesError } =
      await supabase
        .from("vehicle_market_listings")
        .select(
          `
            id,
            source,
            source_url,
            year,
            make,
            model,
            trim,
            price,
            mileage,
            location,
            listed_at,
            fetched_at
          `
        )
        .eq("vehicle_id", vehicle.id)
        .eq("dealership_id", profile.dealership_id)
        .not("price", "is", null)
        .order("price", {
          ascending: true,
        });

    if (comparablesError) {
      console.error(
        "Supabase pricing comparables lookup error:",
        comparablesError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            comparablesError.message ||
            "Failed to load competitive listings.",
        },
        { status: 500 }
      );
    }

    // Calculate Days on Market from listed_at.
    const daysOnMarket = vehicle.listed_at
      ? Math.max(
          0,
          Math.floor(
            (Date.now() -
              new Date(vehicle.listed_at).getTime()) /
              86400000
          )
        )
      : null;

    return NextResponse.json(
      {
        success: true,

        vehicle: {
          id: vehicle.id,
          vin: vehicle.vin,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          trim: vehicle.trim,
          current_price: vehicle.price,
          mileage: vehicle.mileage,
          status: vehicle.status,
        },

        pricing: {
          low_price: analysis?.low_price ?? null,
          market_price: analysis?.market_price ?? null,
          high_price: analysis?.high_price ?? null,
          recommended_price:
            analysis?.recommended_price ?? null,
          comparable_count:
            analysis?.comparable_count ??
            comparables?.length ??
            0,
          calculated_at:
            analysis?.calculated_at ?? null,
        },

        days_on_market: daysOnMarket,

        comparables: comparables ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Pricing API error:",
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