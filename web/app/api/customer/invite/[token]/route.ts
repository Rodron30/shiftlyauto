import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * GET /api/customer/invite/[token]
 *
 * Validates a customer invitation token.
 *
 * SECURITY:
 * - This endpoint is public (no authentication required) since
 *   the customer hasn't signed up yet.
 * - Uses the get_customer_invite() RPC function which only returns
 *   valid, unused, non-expired invitations.
 * - Does not expose sensitive information beyond what's needed for signup.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing invitation token" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Validate the customer invitation
    const { data: invite, error } = await supabase
      .rpc("get_customer_invite", { p_token: token });

    if (error) {
      console.error("Customer invite validation error:", error);
      return NextResponse.json(
        { success: false, error: "Invalid customer invitation" },
        { status: 400 }
      );
    }

    if (!invite || invite.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired customer invitation" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      customer_name: invite[0].customer_name,
      email: invite[0].email,
      dealership_name: invite[0].dealership_name,
      dealership_id: invite[0].dealership_id,
    });
  } catch (error) {
    console.error("Customer invite validation error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to validate customer invitation" },
      { status: 500 }
    );
  }
}
