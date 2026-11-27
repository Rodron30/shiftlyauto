import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Missing signup code" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();

    // Validate dealership signup code
    const { data: dealership, error } = await supabase
      .from("dealerships")
      .select("id, name")
      .eq("signup_code", code)
      .single();

    if (error || !dealership) {
      return NextResponse.json(
        { success: false, error: "Invalid dealership signup code" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      dealership: {
        id: dealership.id,
        name: dealership.name,
      },
    });
  } catch (error) {
    console.error("Validate signup code error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to validate signup code" },
      { status: 500 },
    );
  }
}
