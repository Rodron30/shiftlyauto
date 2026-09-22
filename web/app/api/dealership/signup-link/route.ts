import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Only admins can access signup links" },
        { status: 403 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Get dealership signup code
    const { data: dealership, error } = await supabase
      .from("dealerships")
      .select("id, name, signup_code")
      .eq("id", profile.dealership_id)
      .single();

    if (error || !dealership) {
      return NextResponse.json(
        { success: false, error: "Failed to get dealership" },
        { status: 500 }
      );
    }

    // Generate signup link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const signupLink = `${baseUrl}/signup?dealership=${dealership.signup_code}`;

    return NextResponse.json({
      success: true,
      dealership: {
        id: dealership.id,
        name: dealership.name,
        signupCode: dealership.signup_code,
        signupLink,
      },
    });
  } catch (error) {
    console.error("Get signup link error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get signup link" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Only admins can regenerate signup codes" },
        { status: 403 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Regenerate signup code
    const { data: newCode, error } = await supabase
      .rpc("regenerate_dealership_signup");

    if (error) {
      console.error("Regenerate signup code error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to regenerate signup code" },
        { status: 500 }
      );
    }

    // Get updated dealership info
    const { data: dealership } = await supabase
      .from("dealerships")
      .select("id, name, signup_code")
      .eq("id", profile.dealership_id)
      .single();

    if (!dealership) {
      return NextResponse.json(
        { success: false, error: "Failed to get dealership after regeneration" },
        { status: 500 }
      );
    }

    // Generate new signup link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const signupLink = `${baseUrl}/signup?dealership=${newCode}`;

    return NextResponse.json({
      success: true,
      dealership: {
        id: dealership.id,
        name: dealership.name,
        signupCode: newCode,
        signupLink,
      },
    });
  } catch (error) {
    console.error("Regenerate signup link error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to regenerate signup link" },
      { status: 500 }
    );
  }
}
