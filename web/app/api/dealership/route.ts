import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

type UpdateBody = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
};

const DEALERSHIP_COLUMNS = `
  id,
  name,
  phone,
  email,
  website,
  address,
  subscription_plan
`;

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();

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

    const supabase =
      await createSupabaseServerClient();

    const {
      data: dealershipRows,
      error: dealershipError,
    } = await supabase
      .from("dealerships")
      .select(DEALERSHIP_COLUMNS)
      .eq(
        "id",
        profile.dealership_id
      )
      .limit(1);

    if (dealershipError) {
      console.error(
        "Supabase dealership lookup error:",
        {
          message:
            dealershipError.message,
          details:
            dealershipError.details,
          hint:
            dealershipError.hint,
          code:
            dealershipError.code,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            dealershipError.message ||
            "Failed to load dealership.",
          details:
            dealershipError.details ||
            null,
          hint:
            dealershipError.hint ||
            null,
          code:
            dealershipError.code ||
            null,
        },
        { status: 500 }
      );
    }

    const dealership =
      dealershipRows?.[0] ?? null;

    if (!dealership) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Dealership not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        dealership,
        role: profile.role,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Dealership GET error:",
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

export async function PATCH(
  request: Request
) {
  try {
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

    if (profile.role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only dealership admins can edit these settings.",
        },
        { status: 403 }
      );
    }

    let body: UpdateBody;

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

    const supabase =
      await createSupabaseServerClient();

    const updateData: Record<
      string,
      string | null
    > = {
      updated_at:
        new Date().toISOString(),
    };

    if (
      typeof body.name === "string"
    ) {
      const name =
        body.name.trim();

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Dealership name cannot be empty.",
          },
          { status: 400 }
        );
      }

      updateData.name = name;
    }

    if (
      body.phone !== undefined
    ) {
      updateData.phone =
        typeof body.phone ===
          "string" &&
        body.phone.trim()
          ? body.phone.trim()
          : null;
    }

    if (
      body.email !== undefined
    ) {
      updateData.email =
        typeof body.email ===
          "string" &&
        body.email.trim()
          ? body.email.trim()
          : null;
    }

    if (
      body.website !== undefined
    ) {
      updateData.website =
        typeof body.website ===
          "string" &&
        body.website.trim()
          ? body.website.trim()
          : null;
    }

    if (
      body.address !== undefined
    ) {
      updateData.address =
        typeof body.address ===
          "string" &&
        body.address.trim()
          ? body.address.trim()
          : null;
    }

    const {
      data: dealershipRows,
      error: updateError,
    } = await supabase
      .from("dealerships")
      .update(updateData)
      .eq(
        "id",
        profile.dealership_id
      )
      .select(
        DEALERSHIP_COLUMNS
      )
      .limit(1);

    if (updateError) {
      console.error(
        "Supabase dealership update error:",
        {
          message:
            updateError.message,
          details:
            updateError.details,
          hint:
            updateError.hint,
          code:
            updateError.code,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            updateError.message ||
            "Failed to update dealership.",
          details:
            updateError.details ||
            null,
          hint:
            updateError.hint ||
            null,
          code:
            updateError.code ||
            null,
        },
        { status: 500 }
      );
    }

    const dealership =
      dealershipRows?.[0] ?? null;

    if (!dealership) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Dealership was not updated.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        dealership,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Dealership PATCH error:",
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