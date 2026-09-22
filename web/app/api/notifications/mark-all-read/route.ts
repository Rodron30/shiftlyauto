import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

export async function POST() {
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

    // Mark all dealership-wide + user-specific unread notifications as read
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("dealership_id", profile.dealership_id)
      .or(`user_id.is.null,user_id.eq.${profile.id}`)
      .is("read_at", null);

    if (error) {
      console.error("Mark all read POST error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to mark all notifications as read.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mark all read API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}
