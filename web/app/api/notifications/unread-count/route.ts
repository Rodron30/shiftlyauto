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

    // Count unread dealership-wide + user-specific notifications
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("dealership_id", profile.dealership_id)
      .or(`user_id.is.null,user_id.eq.${profile.id}`)
      .is("read_at", null);

    if (error) {
      console.error("Unread count GET error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load unread count.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        count: count || 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unread count API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}
