import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

import {
  getSaasLimit,
  getSaasLimitError,
  requireSaasAccess,
} from "@/lib/saas";

export async function GET() {
  try {
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
        mileage,
        description,
        status,
        primary_image,
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

    const fuel =
      String(body.fuel ?? "").trim() || null;

    const description =
      String(body.description ?? "").trim() || null;

    const status =
      String(body.status ?? "AVAILABLE")
        .trim()
        .toUpperCase() || "AVAILABLE";

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

    if (!vin || vin.length !== 17) {
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

    const supabase =
      await createSupabaseServerClient();

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

    const { data: vehicle, error } =
      await supabase
        .from("vehicles")
        .insert({
          dealership_id: profile.dealership_id,
          vin,
          year,
          make,
          model,
          trim,
          body: vehicleBody,
          engine,
          drivetrain,
          fuel,
          price,
          mileage,
          description,
          status,
          primary_image: null,
          created_by: profile.id,
        })
        .select()
        .single();

    if (error) {
      console.error(
        "Supabase vehicle insert error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create vehicle.",
        },
        { status: 500 }
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





