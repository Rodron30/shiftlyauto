import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

const NOTIFICATION_SELECT = `
  id,
  type,
  category,
  title,
  message,
  target_url,
  metadata,
  read_at,
  created_at
`;

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || "20"), 50);
    const offset = Number(searchParams.get("offset") || "0");

    const supabase = await createSupabaseServerClient();

    // Get dealership-wide notifications + user-specific notifications
    const { data, error } = await supabase
      .from("notifications")
      .select(NOTIFICATION_SELECT)
      .eq("dealership_id", profile.dealership_id)
      .or(`user_id.is.null,user_id.eq.${profile.id}`)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Notifications GET error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load notifications.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        notifications: data ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Notifications API error:", error);

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
          error: "Sign in to a dealership first.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      type,
      category,
      title,
      message,
      target_url,
      metadata,
    } = body ?? {};

    if (!type || !category || !title || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "type, category, title, and message are required.",
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("notifications")
      .insert({
        dealership_id: profile.dealership_id,
        user_id: null,
        type,
        category,
        title,
        message,
        target_url: target_url || null,
        metadata: metadata || {},
      })
      .select(NOTIFICATION_SELECT)
      .single();

    if (error) {
      console.error("Notifications POST error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create notification.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        notification: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Notifications POST API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}
