import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

import { generateInviteToken } from "@/lib/shareToken";

import {
  getSaasLimit,
  getSaasLimitError,
  requireSaasAccess,
} from "@/lib/saas";

type InviteBody = {
  email: string;
  role: "manager" | "salesperson";
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
      error: "Only dealership admins can manage team invites.",
    },
    { status: 403 }
  );
}

/**
 * POST /api/team/invite
 *
 * Creates a dealership staff invitation.
 *
 * SECURITY:
 * - User must be authenticated.
 * - User must belong to a dealership.
 * - User must be an admin.
 * - Invite is always created for the authenticated user's dealership.
 * - Duplicate active invites for the same dealership/email are blocked.
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

    let body: InviteBody;

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

    const email = body.email?.trim().toLowerCase();
    const role = body.role || "salesperson";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Enter a valid email.",
        },
        { status: 400 }
      );
    }

    if (!["manager", "salesperson"].includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Role must be manager or salesperson.",
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const saasAccess = await requireSaasAccess();

    if (!saasAccess.ok) {
      return NextResponse.json(
        {
          success: false,
          error: saasAccess.error,
        },
        { status: saasAccess.status }
      );
    }

    const userLimit = getSaasLimit(
      saasAccess.context.plan,
      "users"
    );

    if (userLimit !== null) {
      const { count: userCount, error: userCountError } =
        await supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .eq("dealership_id", profile.dealership_id);

      if (userCountError) {
        console.error(
          "Team user count lookup error:",
          userCountError
        );

        return NextResponse.json(
          {
            success: false,
            error: "Failed to check team user limit.",
          },
          { status: 500 }
        );
      }

      if ((userCount ?? 0) >= userLimit) {
        return NextResponse.json(
          {
            success: false,
            error: getSaasLimitError("User", userLimit),
          },
          { status: 403 }
        );
      }
    }

    /*
     * Prevent duplicate active invites for the same
     * dealership/email.
     */
    const { data: existingInvite, error: existingInviteError } =
      await supabase
        .from("dealership_invites")
        .select(
          "id, email, role, token, created_at, expires_at, used_at"
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
        "Existing invite lookup error:",
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
            "An active invite already exists for this email.",
          invite: existingInvite,
        },
        { status: 409 }
      );
    }

    const token = generateInviteToken();

    const { data: invite, error } = await supabase
      .from("dealership_invites")
      .insert({
        dealership_id: profile.dealership_id,
        email,
        role,
        token,
        created_by: profile.id,
      })
      .select(
        "id, email, role, token, created_at, expires_at, used_at"
      )
      .single();

    if (error || !invite) {
      console.error("Invite creation error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create invite.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Invite link created successfully.",
        invite,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/team/invite error:", error);

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
 * GET /api/team/invite
 *
 * Lists dealership invitations.
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
      .from("dealership_invites")
      .select(
        "id, email, role, token, created_at, expires_at, used_at"
      )
      .eq("dealership_id", profile.dealership_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Invite list error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load invites.",
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
    console.error("GET /api/team/invite error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}







