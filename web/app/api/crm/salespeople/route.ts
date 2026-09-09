import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in to a dealership first.",
        },
        { status: 401 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role")
      .eq("dealership_id", profile.dealership_id)
      .in("role", ["salesperson", "manager", "admin"])
      .order("name", { ascending: true });

    if (error) {
      console.error("CRM salespeople lookup error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load salespeople.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        users: data ?? [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("CRM salespeople API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}


