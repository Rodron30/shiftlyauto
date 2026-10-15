import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

function tokenMatches(token: string | undefined, tokenHash: string) {
  if (!token) return false;

  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return hash === tokenHash;
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const admin = createSupabaseAdminClient();

    const { data: device, error: findError } = await admin
      .from("trusted_devices")
      .select("id, token_hash")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (findError) {
      console.error("Failed to find trusted device:", findError);
      return NextResponse.json(
        { success: false, error: "Failed to find trusted device" },
        { status: 500 }
      );
    }

    if (!device) {
      return NextResponse.json(
        { success: false, error: "Trusted device not found" },
        { status: 404 }
      );
    }

    const { error } = await admin
      .from("trusted_devices")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to revoke trusted device:", error);
      return NextResponse.json(
        { success: false, error: "Failed to revoke trusted device" },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ success: true });

    if (
      tokenMatches(
        request.cookies.get("trusted_device")?.value,
        device.token_hash,
      )
    ) {
      response.cookies.delete("trusted_device");
    }

    return response;
  } catch (error) {
    console.error("Trusted device revocation error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const admin = createSupabaseAdminClient();

    const { data: device, error: findError } = await admin
      .from("trusted_devices")
      .select("id, token_hash")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (findError) {
      console.error("Failed to find trusted device:", findError);
      return NextResponse.json(
        { success: false, error: "Failed to find trusted device" },
        { status: 500 }
      );
    }

    if (!device) {
      return NextResponse.json(
        { success: false, error: "Trusted device not found" },
        { status: 404 }
      );
    }

    const { error: deleteError } = await admin
      .from("trusted_devices")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Failed to delete trusted device:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete trusted device" },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ success: true });

    if (
      tokenMatches(
        request.cookies.get("trusted_device")?.value,
        device.token_hash,
      )
    ) {
      response.cookies.delete("trusted_device");
    }

    return response;
  } catch (error) {
    console.error("Trusted device deletion error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
