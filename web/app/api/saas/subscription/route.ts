import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile?.dealership_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in to a dealership first.",
        },
        { status: 401 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("saas_subscriptions")
      .select(`
        id,
        dealership_id,
        status,
        billing_interval,
        current_period_start,
        current_period_end,
        trial_ends_at,
        canceled_at,
        created_at,
        updated_at,
        plan:saas_plans (
          id,
          code,
          name,
          description,
          monthly_price,
          annual_price,
          max_users,
          max_vehicles,
          max_reports_per_month,
          max_ai_requests_per_month,
          max_integrations,
          features
        )
      `)
      .eq("dealership_id", profile.dealership_id)
      .maybeSingle();

    if (error) {
      console.error("SaaS subscription lookup error:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to load SaaS subscription.",
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "SaaS subscription not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: data,
    });
  } catch (error) {
    console.error("SaaS subscription API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load SaaS subscription.",
      },
      { status: 500 }
    );
  }
}
