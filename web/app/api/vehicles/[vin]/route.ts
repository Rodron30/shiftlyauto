import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

import { decodeVin } from "@/lib/vinDecode";

import {
  requireSaasAccess,
} from "@/lib/saas";

import { convertToCAD, normalizeMileageToKm } from "@/lib/currency";

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
  transmission,
  fuel,
  price,
  currency,
  mileage,
  mileage_unit,
  location,
  description,
  status,
  primary_image,
  images,
  exterior_color,
  interior_color,
  has_clean_title,
  condition,
  source_url,
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
      // Vehicle already exists in this dealership - return it instead of creating a duplicate
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

    return NextResponse.json(
      {
        success: false,
        error: "Vehicle not found.",
        vin: normalizedVin,
      },
      { status: 404 }
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
 * Helper function to build updates object from request body
 */
type VehicleUpdateBody = {
  year?: unknown;
  make?: unknown;
  model?: unknown;
  trim?: unknown;
  body?: unknown;
  engine?: unknown;
  drivetrain?: unknown;
  transmission?: unknown;
  fuel?: unknown;
  price?: unknown;
  mileage?: unknown;
  description?: unknown;
  status?: unknown;
  primary_image?: unknown;
  images?: unknown;
  currency?: unknown;
  mileage_unit?: unknown;
  location?: unknown;
  exterior_color?: unknown;
  interior_color?: unknown;
  has_clean_title?: unknown;
  condition?: unknown;
  source_url?: unknown;
};

function buildUpdates(
  body: VehicleUpdateBody,
  year: number | null,
  make: string | null,
  model: string | null,
  trim: string | null,
  vehicleBody: string | null,
  engine: string | null,
  drivetrain: string | null,
  fuel: string | null,
  price: number | null,
  mileage: number | null,
  description: string | null,
  status: string | null,
  primaryImage: string | null,
  images: string[] | null,
  currency: string | null,
  mileageUnit: string | null,
  location: string | null,
  exteriorColor: string | null,
  interiorColor: string | null,
  hasCleanTitle: boolean | null,
  condition: string | null,
  sourceUrl: string | null
): Record<string, unknown> {
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
  if ("transmission" in body) updates.transmission = body.transmission == null || String(body.transmission).trim() === "" ? null : String(body.transmission).trim();
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
  if ("images" in body) {
    updates.images = images;
  }

  // Use the converted values if provided
  if (currency) updates.currency = currency;
  if (mileageUnit) updates.mileage_unit = mileageUnit;

  // Additional fields from DealerInspire scanner
  if ("location" in body) updates.location = location;
  if ("exterior_color" in body) updates.exterior_color = exteriorColor;
  if ("interior_color" in body) updates.interior_color = interiorColor;
  if ("has_clean_title" in body) updates.has_clean_title = hasCleanTitle;
  if ("condition" in body) updates.condition = condition;
  if ("source_url" in body) updates.source_url = sourceUrl;

  return updates;
}

/**
 * PATCH /api/vehicles/:vin
 *
 * Updates inventory/vehicle fields. Creates vehicle if it doesn't exist (upsert pattern).
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

    // Customers cannot edit vehicles
    if (profile.role === "customer") {
      return NextResponse.json(
        {
          success: false,
          error: "Customers do not have permission to edit vehicles.",
        },
        { status: 403 }
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

    const rawPrice =
      body.price === "" || body.price == null
        ? null
        : Number(
            String(body.price).replace(/,/g, "")
          );

    const rawCurrency = body.currency ? String(body.currency).trim().toUpperCase() : null;
    const rawMileage =
      body.mileage === "" || body.mileage == null
        ? null
        : Number(
            String(body.mileage).replace(/,/g, "")
          );

    const rawMileageUnit = body.mileageUnit ? String(body.mileageUnit).trim().toUpperCase() : null;

    // Perform actual currency conversion if needed
    let price = rawPrice;
    let currency = rawCurrency;
    
    if (rawPrice !== null && rawCurrency && rawCurrency !== "CAD") {
      const convertedPrice = await convertToCAD(rawPrice, rawCurrency);
      if (convertedPrice !== null) {
        price = convertedPrice;
        currency = "CAD";
      }
    }

    // Perform actual mileage conversion if needed
    let mileage = rawMileage;
    let mileageUnit = rawMileageUnit;
    
    if (rawMileage !== null && rawMileageUnit && rawMileageUnit !== "KM") {
      const convertedMileage = normalizeMileageToKm(rawMileage, rawMileageUnit);
      if (convertedMileage !== null) {
        mileage = convertedMileage;
        mileageUnit = "KM";
      }
    }

    const primaryImage =
      body.primary_image == null ||
      String(body.primary_image).trim() === ""
        ? null
        : String(body.primary_image).trim();

    const images =
      body.images && Array.isArray(body.images)
        ? body.images
        : null;

    const location =
      body.location == null ||
      String(body.location).trim() === ""
        ? null
        : String(body.location).trim();

    const exteriorColor =
      body.exterior_color == null ||
      String(body.exterior_color).trim() === ""
        ? null
        : String(body.exterior_color).trim();

    const interiorColor =
      body.interior_color == null ||
      String(body.interior_color).trim() === ""
        ? null
        : String(body.interior_color).trim();

    const hasCleanTitle =
      body.has_clean_title == null
        ? null
        : Boolean(body.has_clean_title);

    const condition =
      body.condition == null ||
      String(body.condition).trim() === ""
        ? null
        : String(body.condition).trim();

    const sourceUrl =
      body.source_url == null ||
      String(body.source_url).trim() === ""
        ? null
        : String(body.source_url).trim();

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

    // Allow 0 mileage for new vehicles
    if (mileage === 0) {
      // Preserve 0 mileage for new vehicles
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
        .select(VEHICLE_COLUMNS)
        .eq("vin", normalizedVin)
        .eq("dealership_id", profile.dealership_id)
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

    // If vehicle doesn't exist, create it first (upsert pattern)
    if (!vehicle) {
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

      const { data: insertedRows, error: insertError } =
        await supabase.rpc("insert_vehicles_atomic", {
          p_vehicles: [
            {
              vin: normalizedVin,
              year: decoded.year,
              make: decoded.make,
              model: decoded.model,
              trim: decoded.trim,
              body: decoded.body,
              engine: decoded.engine,
              drivetrain: decoded.drivetrain,
              fuel: decoded.fuel,
              currency: "CAD",
              mileage_unit: "KM",
            },
          ],
        });

      const inserted = insertedRows?.[0] ?? null;

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

        // Handle race condition: if vehicle was created by another request, fetch it
        if (
          insertError.code === "23514" &&
          insertError.message?.includes("Vehicle limit reached")
        ) {
          return NextResponse.json(
            {
              success: false,
              error: insertError.message,
            },
            { status: 403 }
          );
        }

        if (insertError.code === "42501") {
          return NextResponse.json(
            {
              success: false,
              error:
                insertError.message ||
                "Vehicle access denied.",
            },
            { status: 403 }
          );
        }

        if (insertError.code === "23505") {
          const { data: raceVehicle, error: raceError } = await supabase
            .from("vehicles")
            .select(VEHICLE_COLUMNS)
            .eq("vin", normalizedVin)
            .eq("dealership_id", profile.dealership_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (!raceError && raceVehicle) {
            // Vehicle was created in race condition, proceed with update
            const updates = buildUpdates(body, year, make, model, trim, vehicleBody, engine, drivetrain, fuel, price, mileage, description, status, primaryImage, images, currency, mileageUnit, location, exteriorColor, interiorColor, hasCleanTitle, condition, sourceUrl);
            const { data: updated, error: updateError } = await supabase
              .from("vehicles")
              .update(updates)
              .eq("id", raceVehicle.id)
              .eq("dealership_id", profile.dealership_id)
              .is("archived_at", null)
              .select(VEHICLE_COLUMNS)
              .single();

            if (updateError) {
              console.error("Supabase vehicle update error after race condition:", updateError);
              return NextResponse.json(
                {
                  success: false,
                  error: updateError.message || "Failed to update vehicle.",
                },
                { status: 500 }
              );
            }

            return NextResponse.json(
              {
                success: true,
                vehicle: updated,
              },
              { status: 200 }
            );
          }
        }

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

      // Apply the updates to the newly created vehicle
      const updates = buildUpdates(body, year, make, model, trim, vehicleBody, engine, drivetrain, fuel, price, mileage, description, status, primaryImage, images, currency, mileageUnit, location, exteriorColor, interiorColor, hasCleanTitle, condition, sourceUrl);
      
      if (Object.keys(updates).length > 1) { // More than just updated_at
        const { data: updated, error: updateError } = await supabase
          .from("vehicles")
          .update(updates)
          .eq("id", inserted.id)
          .eq("dealership_id", profile.dealership_id)
          .is("archived_at", null)
          .select(VEHICLE_COLUMNS)
          .single();

        if (updateError) {
          console.error("Supabase vehicle update error:", updateError);
          return NextResponse.json(
            {
              success: false,
              error: updateError.message || "Failed to update vehicle.",
            },
            { status: 500 }
          );
        }

        return NextResponse.json(
          {
            success: true,
            vehicle: updated,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          vehicle: inserted,
        },
        { status: 200 }
      );
    }

    // Vehicle exists, update it
    const updates = buildUpdates(body, year, make, model, trim, vehicleBody, engine, drivetrain, fuel, price, mileage, description, status, primaryImage, images, currency, mileageUnit, location, exteriorColor, interiorColor, hasCleanTitle, condition, sourceUrl);
    
    // Restore archived vehicle before checking for an empty update.
    if (vehicle.archived_at) {
      updates.archived_at = null;
      if (!("status" in body) || !status) {
        updates.status = "AVAILABLE";
      }
    }

    // If no updates to apply, just return the existing vehicle.
    if (Object.keys(updates).length === 1) {
      return NextResponse.json(
        {
          success: true,
          vehicle: vehicle,
        },
        { status: 200 }
      );
    }

    const { data, error } = await supabase
      .from("vehicles")
      .update(updates)
      .eq("id", vehicle.id)
      .eq("dealership_id", profile.dealership_id)
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

    if (
      profile.role !== "admin" &&
      profile.role !== "manager" &&
      profile.role !== "salesperson"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You do not have permission to archive vehicles.",
        },
        { status: 403 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data: vehicle, error: lookupError } = await supabase
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
          error: "Failed to find vehicle.",
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
      .select("id, vin, archived_at, updated_at")
      .maybeSingle();

    if (error) {
      console.error(
        "Supabase vehicle archive error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to archive vehicle.",
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "Vehicle could not be archived.",
        },
        { status: 409 }
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
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}
