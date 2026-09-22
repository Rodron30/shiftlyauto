import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Missing dealership code" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Validate the dealership signup code
    const { data: dealership, error } = await supabase
      .rpc("validate_dealership_signup", { p_code: code });

    if (error) {
      console.error("Dealership validation error:", error);
      return NextResponse.json(
        { success: false, error: "Invalid dealership signup code" },
        { status: 400 }
      );
    }

    if (!dealership || dealership.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid dealership signup code" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      dealership: {
        id: dealership[0].id,
        name: dealership[0].name,
      },
    });
  } catch (error) {
    console.error("Dealership validation error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to validate dealership" },
      { status: 500 }
    );
  }
}
