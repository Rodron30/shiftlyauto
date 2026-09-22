import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const supabase = await createSupabaseServerClient();

    // Verify the notification belongs to the user's dealership and they can access it
    const { data: notification, error: fetchError } = await supabase
      .from("notifications")
      .select("id, user_id")
      .eq("id", id)
      .eq("dealership_id", profile.dealership_id)
      .maybeSingle();

    if (fetchError || !notification) {
      return NextResponse.json(
        {
          success: false,
          error: "Notification not found.",
        },
        { status: 404 }
      );
    }

    // User can only mark user-specific notifications as read
    if (notification.user_id && notification.user_id !== profile.id) {
      return NextResponse.json(
        {
          success: false,
          error: "You can only mark your own notifications as read.",
        },
        { status: 403 }
      );
    }

    // Mark as read
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Notification PATCH error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to mark notification as read.",
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
    console.error("Notification PATCH API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}
