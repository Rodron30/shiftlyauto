import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

type RouteContext = {
  params: Promise<{ vin: string }>;
};

type Vehicle = {
  id: string;
  dealership_id: string;
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  body: string | null;
  engine: string | null;
  drivetrain: string | null;
  fuel: string | null;
  price: number | null;
  mileage: number | null;
  description: string | null;
  status: string | null;
  primary_image: string | null;
};

type VehicleMatch = Vehicle & {
  matchScore: number;
  reasons: string[];
};

const VEHICLE_COLUMNS =
  "id, dealership_id, vin, year, make, model, trim, body, engine, drivetrain, fuel, price, mileage, description, status, primary_image";

function normalizeVin(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function isValidVin(vin: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function calculateMatchScore(source: Vehicle, candidate: Vehicle) {
  let score = 0;
  const reasons: string[] = [];

  const sourceMake = normalizeText(source.make);
  const candidateMake = normalizeText(candidate.make);

  const sourceModel = normalizeText(source.model);
  const candidateModel = normalizeText(candidate.model);

  const sourceTrim = normalizeText(source.trim);
  const candidateTrim = normalizeText(candidate.trim);

  const sourceBody = normalizeText(source.body);
  const candidateBody = normalizeText(candidate.body);

  const sourceEngine = normalizeText(source.engine);
  const candidateEngine = normalizeText(candidate.engine);

  const sourceDrivetrain = normalizeText(source.drivetrain);
  const candidateDrivetrain = normalizeText(candidate.drivetrain);

  const sourceFuel = normalizeText(source.fuel);
  const candidateFuel = normalizeText(candidate.fuel);

  // Make: 20 points
  if (sourceMake && candidateMake && sourceMake === candidateMake) {
    score += 20;
    reasons.push("Same make");
  }

  // Model: 20 points
  if (sourceModel && candidateModel && sourceModel === candidateModel) {
    score += 20;
    reasons.push("Same model");
  }

  // Year: 15 points exact, 8 points within 2 years
  if (
    source.year !== null &&
    candidate.year !== null &&
    Number.isFinite(source.year) &&
    Number.isFinite(candidate.year)
  ) {
    const yearDifference = Math.abs(source.year - candidate.year);

    if (yearDifference === 0) {
      score += 15;
      reasons.push("Same year");
    } else if (yearDifference <= 2) {
      score += 8;
      reasons.push("Similar year");
    }
  }

  // Trim: 10 points
  if (sourceTrim && candidateTrim && sourceTrim === candidateTrim) {
    score += 10;
    reasons.push("Same trim");
  }

  // Body: 10 points
  if (sourceBody && candidateBody && sourceBody === candidateBody) {
    score += 10;
    reasons.push("Same body type");
  }

  // Engine: 10 points
  if (sourceEngine && candidateEngine && sourceEngine === candidateEngine) {
    score += 10;
    reasons.push("Same engine");
  }

  // Drivetrain: 5 points
  if (
    sourceDrivetrain &&
    candidateDrivetrain &&
    sourceDrivetrain === candidateDrivetrain
  ) {
    score += 5;
    reasons.push("Same drivetrain");
  }

  // Fuel: 5 points
  if (sourceFuel && candidateFuel && sourceFuel === candidateFuel) {
    score += 5;
    reasons.push("Same fuel type");
  }

  // Price: 5 points
  if (
    source.price !== null &&
    candidate.price !== null &&
    source.price > 0 &&
    candidate.price > 0
  ) {
    const priceDifference =
      Math.abs(source.price - candidate.price) / source.price;

    if (priceDifference <= 0.05) {
      score += 5;
      reasons.push("Very similar price");
    } else if (priceDifference <= 0.10) {
      score += 3;
      reasons.push("Similar price");
    } else if (priceDifference <= 0.20) {
      score += 1;
      reasons.push("Comparable price");
    }
  }

  return {
    matchScore: score,
    reasons,
  };
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { vin } = await context.params;
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

    const supabase = await createSupabaseServerClient();

    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    // Find the source vehicle.
    const { data: sourceVehicle, error: sourceError } = await supabase
      .from("vehicles")
      .select(VEHICLE_COLUMNS)
      .eq("vin", normalizedVin)
      .eq("dealership_id", profile.dealership_id)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();

    if (sourceError) {
      console.error("Vehicle matching source lookup error:", sourceError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load source vehicle.",
        },
        { status: 500 }
      );
    }

    if (!sourceVehicle) {
      return NextResponse.json(
        {
          success: false,
          error: "Vehicle not found.",
        },
        { status: 404 }
      );
    }

    // Get other active vehicles from the same dealership.
    const { data: candidates, error: candidatesError } = await supabase
      .from("vehicles")
      .select(VEHICLE_COLUMNS)
      .eq("dealership_id", profile.dealership_id)
      .neq("vin", normalizedVin)
      .is("archived_at", null)
      .limit(500);

    if (candidatesError) {
      console.error(
        "Vehicle matching candidates lookup error:",
        candidatesError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load matching vehicles.",
        },
        { status: 500 }
      );
    }

    const matches: VehicleMatch[] = (candidates ?? [])
      .map((candidate) => {
        const result = calculateMatchScore(
          sourceVehicle as Vehicle,
          candidate as Vehicle
        );

        return {
          ...(candidate as Vehicle),
          matchScore: result.matchScore,
          reasons: result.reasons,
        };
      })
      .filter((vehicle) => vehicle.matchScore > 0)
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore;
        }

        // Secondary sort by closest price.
        if (
          sourceVehicle.price !== null &&
          a.price !== null &&
          b.price !== null
        ) {
          const aDifference = Math.abs(
            sourceVehicle.price - a.price
          );
          const bDifference = Math.abs(
            sourceVehicle.price - b.price
          );

          return aDifference - bDifference;
        }

        return 0;
      })
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      sourceVehicle,
      matches,
      count: matches.length,
    });
  } catch (error) {
    console.error("Vehicle matching API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}