import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

import { decodeVin } from "@/lib/vinDecode";

import {
  getSaasLimit,
  getSaasLimitError,
  requireSaasAccess,
} from "@/lib/saas";

type RouteContext = {
  params: Promise<{
    vin: string;
  }>;
};

const VEHICLE_COLUMNS = `
  id,
  dealership_id,
  vin,
  year,
  make,
  model,
  trim,
  body,
  engine,
  drivetrain,
  fuel,
  price,
  mileage,
  description,
  status,
  primary_image,
  created_by,
  created_at,
  updated_at,
  archived_at
`;

function normalizeVin(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function isValidVin(vin: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

/**
 * GET /api/vehicles/:vin
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

    const supabase = await createSupabaseServerClient();
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

    const { data: existingRows, error: lookupError } =
      await supabase
        .from("vehicles")
        .select(VEHICLE_COLUMNS)
        .eq("vin", normalizedVin)
        .eq("dealership_id", profile.dealership_id)
        .order("created_at", {
          ascending: false,
        })
        .limit(1);

    if (lookupError) {
      console.error(
        "Supabase vehicle lookup error:",
        lookupError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            lookupError.message ||
            "Failed to load vehicle.",
        },
        { status: 500 }
      );
    }

    const existing = existingRows?.[0] ?? null;

    if (existing?.archived_at) {
      return NextResponse.json(
        {
          success: false,
          error: "Vehicle is archived.",
        },
        { status: 404 }
      );
    }

    if (existing) {
      let checkedByName: string | null = null;

      if (existing.created_by) {
        const { data: creator } = await supabase
          .from("users")
          .select("name, email")
          .eq("id", existing.created_by)
          .maybeSingle();

        checkedByName =
          creator?.name ||
          creator?.email ||
          null;
      }

      return NextResponse.json(
        {
          success: true,
          vehicle: existing,
          source: "database",
          checkedByName,
        },
        { status: 200 }
      );
    }

    const decoded = await decodeVin(normalizedVin);

    if (!decoded || (!decoded.make && !decoded.model)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Vehicle could not be decoded. Please verify the VIN and try again.",
          vin: normalizedVin,
        },
        { status: 404 }
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

    const vehicleLimit = getSaasLimit(
      saasAccess.context.plan,
      "vehicles"
    );

    if (vehicleLimit !== null) {
      const { count: activeVehicleCount, error: vehicleCountError } =
        await supabase
          .from("vehicles")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "dealership_id",
            profile.dealership_id
          )
          .is("archived_at", null);

      if (vehicleCountError) {
        console.error(
          "SaaS vehicle count error:",
          vehicleCountError
        );

        return NextResponse.json(
          {
            success: false,
            error: "Failed to check vehicle plan limit.",
          },
          { status: 500 }
        );
      }

      if (
        (activeVehicleCount ?? 0) >= vehicleLimit
      ) {
        return NextResponse.json(
          {
            success: false,
            error: getSaasLimitError(
              "Vehicle",
              vehicleLimit
            ),
          },
          { status: 403 }
        );
      }
    }

    const { data: inserted, error: insertError } =
      await supabase
        .from("vehicles")
        .insert({
          dealership_id: profile.dealership_id,
          vin: normalizedVin,
          year: decoded.year,
          make: decoded.make,
          model: decoded.model,
          trim: decoded.trim,
          body: decoded.body,
          engine: decoded.engine,
          drivetrain: decoded.drivetrain,
          fuel: decoded.fuel,
          created_by: profile.id,
        })
        .select(VEHICLE_COLUMNS)
        .single();

    if (insertError) {
      console.error(
        "Supabase vehicle insert error:",
        {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            insertError.message ||
            "Failed to save vehicle.",
          details: insertError.details || null,
          hint: insertError.hint || null,
          code: insertError.code || null,
        },
        { status: 500 }
      );
    }

    if (!inserted) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Vehicle was decoded but could not be saved.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        vehicle: inserted,
        source: "decoded_and_saved",
        checkedByName:
          profile.name ||
          profile.email ||
          null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Vehicle API error:",
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
 * PATCH /api/vehicles/:vin
 *
 * Updates inventory/vehicle fields.
 */
export async function PATCH(
  request: Request,
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

    const body = await request.json();

    const year =
      body.year === "" || body.year == null
        ? null
        : Number(body.year);

    const make =
      body.make == null
        ? null
        : String(body.make).trim();

    const model =
      body.model == null
        ? null
        : String(body.model).trim();

    const trim =
      body.trim == null ||
      String(body.trim).trim() === ""
        ? null
        : String(body.trim).trim();

    const vehicleBody =
      body.body == null ||
      String(body.body).trim() === ""
        ? null
        : String(body.body).trim();

    const engine =
      body.engine == null ||
      String(body.engine).trim() === ""
        ? null
        : String(body.engine).trim();

    const drivetrain =
      body.drivetrain == null ||
      String(body.drivetrain).trim() === ""
        ? null
        : String(body.drivetrain).trim();

    const fuel =
      body.fuel == null ||
      String(body.fuel).trim() === ""
        ? null
        : String(body.fuel).trim();

    const description =
      body.description == null ||
      String(body.description).trim() === ""
        ? null
        : String(body.description).trim();

    const status =
      body.status == null
        ? null
        : String(body.status)
            .trim()
            .toUpperCase();

    const price =
      body.price === "" || body.price == null
        ? null
        : Number(
            String(body.price).replace(/,/g, "")
          );

    const mileage =
      body.mileage === "" || body.mileage == null
        ? null
        : Number(
            String(body.mileage).replace(/,/g, "")
          );

    const primaryImage =
      body.primary_image == null ||
      String(body.primary_image).trim() === ""
        ? null
        : String(body.primary_image).trim();

    if (
      year !== null &&
      (!Number.isInteger(year) ||
        year < 1900 ||
        year > 2100)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid vehicle year.",
        },
        { status: 400 }
      );
    }

    if (make !== null && !make) {
      return NextResponse.json(
        {
          success: false,
          error: "Make cannot be empty.",
        },
        { status: 400 }
      );
    }

    if (model !== null && !model) {
      return NextResponse.json(
        {
          success: false,
          error: "Model cannot be empty.",
        },
        { status: 400 }
      );
    }

    if (
      price !== null &&
      (!Number.isFinite(price) || price < 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid price.",
        },
        { status: 400 }
      );
    }

    if (
      mileage !== null &&
      (!Number.isFinite(mileage) ||
        !Number.isInteger(mileage) ||
        mileage < 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid mileage.",
        },
        { status: 400 }
      );
    }

    const allowedStatuses = [
      "AVAILABLE",
      "DRAFT",
      "SOLD",
    ];

    if (
      status !== null &&
      !allowedStatuses.includes(status)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid vehicle status.",
        },
        { status: 400 }
      );
    }

    const supabase =
      await createSupabaseServerClient();

    const { data: existingRows, error: lookupError } =
      await supabase
        .from("vehicles")
        .select("id")
        .eq("vin", normalizedVin)
        .eq("dealership_id", profile.dealership_id)
        .is("archived_at", null)
        .order("created_at", {
          ascending: false,
        })
        .limit(1);

    if (lookupError) {
      console.error(
        "Supabase vehicle PATCH lookup error:",
        lookupError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            lookupError.message ||
            "Failed to find vehicle.",
        },
        { status: 500 }
      );
    }

    const vehicle = existingRows?.[0];

    if (!vehicle) {
      return NextResponse.json(
        {
          success: false,
          error: "Vehicle not found.",
        },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if ("year" in body) updates.year = year;
    if ("make" in body) updates.make = make;
    if ("model" in body) updates.model = model;
    if ("trim" in body) updates.trim = trim;
    if ("body" in body) updates.body = vehicleBody;
    if ("engine" in body) updates.engine = engine;
    if ("drivetrain" in body) {
      updates.drivetrain = drivetrain;
    }
    if ("fuel" in body) updates.fuel = fuel;
    if ("price" in body) updates.price = price;
    if ("mileage" in body) updates.mileage = mileage;
    if ("description" in body) {
      updates.description = description;
    }
    if ("status" in body) {
      updates.status = status;
    }
    if ("primary_image" in body) {
      updates.primary_image = primaryImage;
    }

    const { data, error } = await supabase
      .from("vehicles")
      .update(updates)
      .eq("id", vehicle.id)
      .eq("dealership_id", profile.dealership_id)
      .is("archived_at", null)
      .select(VEHICLE_COLUMNS)
      .single();

    if (error) {
      console.error(
        "Supabase vehicle update error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error.message ||
            "Failed to update vehicle.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        vehicle: data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Vehicle PATCH error:",
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
 * DELETE /api/vehicles/:vin
 *
 * Soft-archives the vehicle.
 * Vehicle history and reports are preserved.
 */
export async function DELETE(
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

    const supabase =
      await createSupabaseServerClient();

    const { data: vehicle, error: lookupError } =
      await supabase
        .from("vehicles")
        .select("id, vin, archived_at")
        .eq("vin", normalizedVin)
        .eq("dealership_id", profile.dealership_id)
        .maybeSingle();

    if (lookupError) {
      console.error(
        "Supabase vehicle archive lookup error:",
        lookupError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            lookupError.message ||
            "Failed to find vehicle.",
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

    if (vehicle.archived_at) {
      return NextResponse.json(
        {
          success: false,
          error: "Vehicle is already archived.",
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("vehicles")
      .update({
        archived_at: now,
        updated_at: now,
      })
      .eq("id", vehicle.id)
      .eq("dealership_id", profile.dealership_id)
      .is("archived_at", null)
      .select(
        "id, vin, archived_at, updated_at"
      )
      .single();

    if (error) {
      console.error(
        "Supabase vehicle archive error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error.message ||
            "Failed to archive vehicle.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Vehicle archived successfully.",
        vehicle: data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Vehicle DELETE/archive error:",
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





