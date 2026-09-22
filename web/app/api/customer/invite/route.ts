import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

import { generateInviteToken } from "@/lib/shareToken";

type CustomerInviteBody = {
  customer_name: string;
  email: string;
};

function unauthorizedResponse() {
  return NextResponse.json(
    {
      success: false,
      error: "Sign in to a dealership first.",
    },
    { status: 401 }
  );
}

function forbiddenResponse() {
  return NextResponse.json(
    {
      success: false,
      error: "Only dealership admins can manage customer invitations.",
    },
    { status: 403 }
  );
}

/**
 * POST /api/customer/invite
 *
 * Creates a customer invitation.
 *
 * SECURITY:
 * - User must be authenticated.
 * - User must belong to a dealership.
 * - User must be an admin.
 * - Invite is always created for the authenticated user's dealership.
 * - Duplicate active invites for the same dealership/email are blocked.
 * - Role is always 'customer' (server-enforced).
 */
export async function POST(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.dealership_id) {
      return unauthorizedResponse();
    }

    if (profile.role !== "admin") {
      return forbiddenResponse();
    }

    let body: CustomerInviteBody;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON body.",
        },
        { status: 400 }
      );
    }

    const customer_name = body.customer_name?.trim();
    const email = body.email?.trim().toLowerCase();

    if (!customer_name || customer_name.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid customer name.",
        },
        { status: 400 }
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Enter a valid email.",
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    /*
     * Prevent duplicate active invites for the same
     * dealership/email.
     */
    const { data: existingInvite, error: existingInviteError } =
      await supabase
        .from("customer_invites")
        .select(
          "id, customer_name, email, token, created_at, expires_at, used_at"
        )
        .eq("dealership_id", profile.dealership_id)
        .ilike("email", email)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existingInviteError) {
      console.error(
        "Existing customer invite lookup error:",
        existingInviteError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to check existing invites.",
        },
        { status: 500 }
      );
    }

    if (existingInvite) {
      return NextResponse.json(
        {
          success: false,
          error:
            "An active customer invitation already exists for this email.",
          invite: existingInvite,
        },
        { status: 409 }
      );
    }

    const token = generateInviteToken();

    const { data: invite, error } = await supabase
      .from("customer_invites")
      .insert({
        dealership_id: profile.dealership_id,
        customer_name,
        email,
        token,
        created_by: profile.id,
      })
      .select(
        "id, customer_name, email, token, created_at, expires_at, used_at"
      )
      .single();

    if (error || !invite) {
      console.error("Customer invite creation error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create customer invitation.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Customer invitation created successfully.",
        invite,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/customer/invite error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/customer/invite
 *
 * Lists customer invitations.
 *
 * SECURITY:
 * - User must be authenticated.
 * - User must belong to a dealership.
 * - User must be an admin.
 * - Results are restricted to the authenticated user's dealership.
 *
 * Invite tokens are sensitive because they can be used as
 * part of the invitation URL. Therefore non-admin users
 * must not be allowed to retrieve them.
 */
export async function GET() {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.dealership_id) {
      return unauthorizedResponse();
    }

    if (profile.role !== "admin") {
      return forbiddenResponse();
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("customer_invites")
      .select(
        "id, customer_name, email, token, created_at, expires_at, used_at"
      )
      .eq("dealership_id", profile.dealership_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Customer invite list error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load customer invitations.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        invites: data ?? [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/customer/invite error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/customer/invite
 *
 * Deletes (revokes) a customer invitation.
 *
 * SECURITY:
 * - User must be authenticated.
 * - User must belong to a dealership.
 * - User must be an admin.
 * - Can only delete invitations for the authenticated user's dealership.
 */
export async function DELETE(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.dealership_id) {
      return unauthorizedResponse();
    }

    if (profile.role !== "admin") {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get("id");

    if (!inviteId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing invitation ID.",
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("customer_invites")
      .delete()
      .eq("id", inviteId)
      .eq("dealership_id", profile.dealership_id);

    if (error) {
      console.error("Customer invite deletion error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to delete customer invitation.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Customer invitation deleted successfully.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/customer/invite error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}
