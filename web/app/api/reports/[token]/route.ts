import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

type RouteContext = {
  params: Promise<{ token: string }>;
};

/**
 * GET /api/reports/:token
 *
 * Public, unauthenticated endpoint.
 *
 * A customer can open a shared report without dealership login.
 *
 * SECURITY:
 * - Only customer_report and created_at are selected.
 * - ai_summary is never exposed.
 * - No direct vehicles/history_events join is exposed.
 * - Public access requires a valid, non-expired share_token
 *   through Supabase RLS.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { token } = await params;

    // IMPORTANT:
    // generateShareToken() (lib/shareToken.ts) only ever produces
    // uppercase characters, and that's exactly what's stored in
    // reports.share_token — so normalize to uppercase here too,
    // matching the PDF route below, in case the token arrives in a
    // different case (e.g. a client that lowercases URLs).
    const cleanToken = token.trim().toUpperCase();

    if (!cleanToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing report token.",
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("reports")
      .select("customer_report, created_at")
      .eq("share_token", cleanToken)
      .maybeSingle();

    if (error) {
      console.error("Public report lookup error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load report.",
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "Report not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        report: data.customer_report,
        created_at: data.created_at,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Public report API error:", error);

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
 * DELETE /api/reports/:token
 *
 * Revokes a public share link by setting share_token to NULL.
 *
 * The report row is NOT deleted.
 *
 * Authorization:
 * - User must be signed in.
 * - User must have a dealership profile.
 * - Report ownership is verified through:
 *
 *     reports.vehicle_id
 *          -> vehicles.id
 *          -> vehicles.dealership_id
 *
 * - Supabase RLS remains an additional security layer.
 */
export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  try {
    /*
     * Verify that the request belongs to a signed-in
     * dealership user.
     */
    const profile = await getCurrentUserProfile();

    if (!profile?.dealership_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in to a dealership first.",
        },
        { status: 401 }
      );
    }

    // Customers cannot delete reports
    if (profile.role === "customer") {
      return NextResponse.json(
        {
          success: false,
          error: "Customers do not have permission to delete reports.",
        },
        { status: 403 }
      );
    }

    const { token } = await params;

    // IMPORTANT:
    // Same normalization as the GET handler above — share_token
    // values are always uppercase (see lib/shareToken.ts), so
    // normalize the incoming token to match before comparing.
    const cleanToken = token.trim().toUpperCase();

    if (!cleanToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing report token.",
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    /*
     * Locate the report using the exact share token.
     *
     * Only the fields needed for ownership verification
     * are selected.
     */
    const { data: report, error: reportLookupError } = await supabase
      .from("reports")
      .select("id, vehicle_id")
      .eq("share_token", cleanToken)
      .maybeSingle();

    if (reportLookupError) {
      console.error(
        "Report ownership lookup error:",
        reportLookupError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to locate report.",
        },
        { status: 500 }
      );
    }

    if (!report) {
      return NextResponse.json(
        {
          success: false,
          error: "Report not found.",
        },
        { status: 404 }
      );
    }

    if (!report.vehicle_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Report is not associated with a vehicle.",
        },
        { status: 409 }
      );
    }

    /*
     * Verify that the report's vehicle belongs to the
     * currently authenticated user's dealership.
     *
     * This prevents one dealership from revoking another
     * dealership's shared report.
     */
    const { data: vehicle, error: vehicleLookupError } = await supabase
      .from("vehicles")
      .select("id, dealership_id")
      .eq("id", report.vehicle_id)
      .eq("dealership_id", profile.dealership_id)
      .maybeSingle();

    if (vehicleLookupError) {
      console.error(
        "Report vehicle ownership lookup error:",
        vehicleLookupError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to verify report ownership.",
        },
        { status: 500 }
      );
    }

    if (!vehicle) {
      return NextResponse.json(
        {
          success: false,
          error: "Report not found.",
        },
        { status: 404 }
      );
    }

    /*
     * Ownership has been verified.
     *
     * Revoke the public share link only.
     *
     * IMPORTANT:
     * - The report row is NOT deleted.
     * - The vehicle is NOT deleted.
     * - History is NOT deleted.
     * - Only share_token is set to NULL.
     */
    const { data, error } = await supabase
      .from("reports")
      .update({
        share_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", report.id)
      .eq("share_token", cleanToken)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Report revoke error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to revoke report.",
        },
        { status: 500 }
      );
    }

    /*
     * If no row was returned, the token may have already
     * been revoked or the row was no longer accessible.
     */
    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "Report not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Report revoke API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}

