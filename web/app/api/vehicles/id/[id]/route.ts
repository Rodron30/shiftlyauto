import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

type RouteContext = {
  params: Promise<{
    id: string;
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
  currency,
  mileage,
  mileage_unit,
  description,
  location,
  status,
  primary_image,
  images,
  created_by,
  created_at,
  updated_at,
  archived_at
`;

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const supabase =
      await createSupabaseServerClient();

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

    const { data: vehicle, error } =
      await supabase
        .from("vehicles")
        .select(VEHICLE_COLUMNS)
        .eq("id", id)
        .eq(
          "dealership_id",
          profile.dealership_id
        )
        .is("archived_at", null)
        .maybeSingle();

    if (error) {
      console.error(
        "Supabase vehicle ID lookup error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error.message ||
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

    return NextResponse.json(
      {
        success: true,
        vehicle,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Vehicle ID API error:",
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
