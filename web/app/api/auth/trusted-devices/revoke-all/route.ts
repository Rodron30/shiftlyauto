import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Use service role to revoke all trusted devices for the user (bypasses RLS for controlled operation)
    const adminSupabase = createSupabaseAdminClient();
    const { error: revokeError } = await adminSupabase
      .from("trusted_devices")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (revokeError) {
      console.error("Failed to revoke all trusted devices:", revokeError);
      return NextResponse.json(
        { success: false, error: "Failed to revoke all trusted devices" },
        { status: 500 }
      );
    }

    // Clear the cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete("trusted_device");
    return response;
  } catch (error) {
    console.error("Revoke all trusted devices error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const adminSupabase = createSupabaseAdminClient();
    const { error: deleteError } = await adminSupabase
      .from("trusted_devices")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Failed to delete all trusted devices:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete all trusted devices" },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete("trusted_device");
    return response;
  } catch (error) {
    console.error("Delete all trusted devices error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
