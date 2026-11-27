import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

import {
  requireSaasAccess,
} from "@/lib/saas";

import { convertToCAD, normalizeMileageToKm } from "@/lib/currency";

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();

    // Customers cannot access vehicle inventory
    if (profile?.role === "customer") {
      return NextResponse.json(
        {
          success: false,
          error: "Customers do not have permission to access vehicle inventory.",
        },
        { status: 403 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("vehicles")
      .select(`
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
        currency,
        mileage,
        description,
          location,
        status,
        primary_image,
        images,
        exterior_color,
        interior_color,
        has_clean_title,
        created_by,
        created_at,
        updated_at
      `).is("archived_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        "Supabase vehicles lookup error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load vehicles.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        vehicles: data ?? [],
        count: data?.length ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Vehicles API error:", error);

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
          error: "You must be signed in to add a vehicle.",
        },
        { status: 401 }
      );
    }

    // Customers cannot create vehicles
    if (profile.role === "customer") {
      return NextResponse.json(
        {
          success: false,
          error: "Customers do not have permission to add vehicles.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const vin = String(body.vin ?? "")
      .trim()
      .toUpperCase();

    const year = Number(body.year);

    const make = String(body.make ?? "").trim();

    const model = String(body.model ?? "").trim();

    const trim =
      String(body.trim ?? "").trim() || null;

    const vehicleBody =
      String(body.body ?? "").trim() || null;

    const engine =
      String(body.engine ?? "").trim() || null;

    const drivetrain =
      String(body.drivetrain ?? "").trim() || null;

    const transmission =
      String(body.transmission ?? "").trim() || null;
    const fuel =
      String(body.fuel ?? "").trim() || null;

    const exteriorColor =
      String(body.exterior_color ?? "").trim() || null;

    const interiorColor =
      String(body.interior_color ?? "").trim() || null;

    const hasCleanTitle =
      body.has_clean_title === true ? true : 
      body.has_clean_title === false ? false : null;

    const description =
      String(body.description ?? "").trim() || null;

    const primaryImage =
      String(body.primary_image ?? "").trim() || null;

    const images = Array.isArray(body.images)
      ? body.images.filter(
          (image: unknown): image is string =>
            typeof image === "string" && image.trim().length > 0
        )
      : [];

    const location =
      String(body.location ?? "").trim() || null;

    const sourceUrl =
      body.source_url == null ||
      String(body.source_url).trim() === ""
        ? null
        : String(body.source_url).trim();

        const status =
      String(body.status ?? "AVAILABLE")
        .trim()
        .toUpperCase() || "AVAILABLE";

    const rawPrice =
      body.price === "" || body.price == null
        ? null
        : Number(
            String(body.price).replace(/,/g, "")
          );

    const rawCurrency =
      String(body.currency ?? "CAD")
        .trim()
        .toUpperCase() || "CAD";

    const rawMileage =
      body.mileage === "" || body.mileage == null
        ? null
        : Number(
            String(body.mileage).replace(/,/g, "")
          );

    const rawMileageUnit =
      String(body.mileageUnit ?? "KM")
        .trim()
        .toUpperCase() || "KM";

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
      } else {
        console.error(`Mileage conversion failed for ${rawMileage} ${rawMileageUnit}, keeping original value`);
      }
    }

    // VIN is required UNLESS we have make, model, and year (for Facebook Marketplace vehicles)
    const hasVehicleData = make && model && year;
    if (!hasVehicleData && (!vin || vin.length !== 17)) {
      return NextResponse.json(
        {
          success: false,
          error: "VIN must be exactly 17 characters, or provide make, model, and year.",
        },
        { status: 400 }
      );
    }

    // If VIN is provided, validate it
    if (vin && vin.length !== 17) {
      return NextResponse.json(
        {
          success: false,
          error: "VIN must be exactly 17 characters.",
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid vehicle year.",
        },
        { status: 400 }
      );
    }

    if (!make || !model) {
      return NextResponse.json(
        {
          success: false,
          error: "Make and model are required.",
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

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid vehicle status.",
        },
        { status: 400 }
      );
    }

    // Canadian market: Only CAD allowed
    if (currency !== "CAD") {
      return NextResponse.json(
        {
          success: false,
          error: "Canadian market only supports CAD currency.",
        },
        { status: 400 }
      );
    }

    // Canadian market: Only KM allowed
    if (mileageUnit !== "KM") {
      return NextResponse.json(
        {
          success: false,
          error: "Canadian market only supports KM mileage units.",
        },
        { status: 400 }
      );
    }

    const supabase =
      await createSupabaseServerClient();

    // Only check for VIN duplicates if VIN is provided
    if (vin) {
      const { data: existingVehicle, error: existingError } =
        await supabase
          .from("vehicles")
          .select("id")
          .eq(
            "dealership_id",
            profile.dealership_id
          )
          .eq("vin", vin)
          .is("archived_at", null)
          .maybeSingle();

      if (existingError) {
        console.error(
          "Vehicle duplicate check error:",
          existingError
        );

        return NextResponse.json(
          {
            success: false,
            error: "Failed to check existing vehicle.",
          },
          { status: 500 }
        );
      }

      if (existingVehicle) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A vehicle with this VIN already exists.",
          },
          { status: 409 }
        );
      }
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

    const { data: insertedVehicles, error } =
      await supabase.rpc("insert_vehicles_atomic", {
        p_vehicles: [
          {
            vin: vin || null,
            year,
            make,
            model,
            trim,
            body: vehicleBody,
            engine,
            drivetrain,
            fuel,
            price,
            currency: "CAD",
            mileage,
            transmission,
            mileage_unit: "KM",
            primary_image: primaryImage,
            images,
            description,
            location,
            status,
            exterior_color: exteriorColor,
            interior_color: interiorColor,
            has_clean_title: hasCleanTitle,
            source_url: sourceUrl,
          },
        ],
      });

    const vehicle = insertedVehicles?.[0] ?? null;

    if (error) {
      console.error(
        "Supabase atomic vehicle insert error:",
        error
      );

      if (
        error.code === "23505" &&
        error.message?.includes("vehicles_vin_dealership_unique")
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "A vehicle with this VIN already exists.",
          },
          { status: 409 }
        );
      }

      if (
        error.code === "23514" &&
        error.message?.includes("Vehicle limit reached")
      ) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 403 }
        );
      }

      if (error.code === "42501") {
        return NextResponse.json(
          {
            success: false,
            error: error.message || "Vehicle access denied.",
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to create vehicle.",
        },
        { status: 500 }
      );
    }

    if (!vehicle) {
      return NextResponse.json(
        {
          success: false,
          error: "Vehicle was not created.",
        },
        { status: 500 }
      );
    }

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert({
        dealership_id: profile.dealership_id,
        user_id: null,
        type: "SUCCESS",
        category: "VEHICLE",
        title: "Vehicle Added",
        message: `${year} ${make} ${model} was added to inventory.`,
        target_url: vehicle?.id
          ? vin
            ? `/vehicles/${vin}`
            : `/vehicles/id/${vehicle.id}`
          : "/vehicles",
        metadata: {
          vehicle_id: vehicle.id,
          vin: vin || null,
        },
      });

    if (notificationError) {
      console.error(
        "Vehicle notification insert error:",
        notificationError
      );
    }

    return NextResponse.json(
      {
        success: true,
        vehicle,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Create vehicle API error:",
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
