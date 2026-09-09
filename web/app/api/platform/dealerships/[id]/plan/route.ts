import { NextResponse } from "next/server";

import {
  createSupabaseServiceRoleClient,
  getCurrentPlatformAdmin,
} from "@/lib/platform";

import { writePlatformAuditLog } from "@/lib/platformAudit";

const ALLOWED_PLANS = [
  "STARTER",
  "GROWTH",
  "ENTERPRISE",
] as const;

type AllowedPlan = (typeof ALLOWED_PLANS)[number];

function isAllowedPlan(value: unknown): value is AllowedPlan {
  return (
    typeof value === "string" &&
    ALLOWED_PLANS.includes(value as AllowedPlan)
  );
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const platformAdmin = await getCurrentPlatformAdmin();

    if (!platformAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Platform administrator access required.",
        },
        { status: 403 }
      );
    }

    if (platformAdmin.role !== "PLATFORM_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error: "Platform administrator role required.",
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Dealership ID is required.",
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const planCode = body?.planCode;

    if (!isAllowedPlan(planCode)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid plan. Allowed values: STARTER, GROWTH, ENTERPRISE.",
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceRoleClient();

    const { data: dealership, error: dealershipError } =
      await supabase
        .from("dealerships")
        .select("id, name")
        .eq("id", id)
        .maybeSingle();

    if (dealershipError) {
      console.error(
        "Platform dealership lookup error:",
        dealershipError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load dealership.",
        },
        { status: 500 }
      );
    }

    if (!dealership) {
      return NextResponse.json(
        {
          success: false,
          error: "Dealership not found.",
        },
        { status: 404 }
      );
    }

    const { data: plan, error: planError } = await supabase
      .from("saas_plans")
      .select("id, code, name")
      .eq("code", planCode)
      .eq("is_active", true)
      .maybeSingle();

    if (planError) {
      console.error(
        "Platform SaaS plan lookup error:",
        planError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load SaaS plan.",
        },
        { status: 500 }
      );
    }

    if (!plan) {
      return NextResponse.json(
        {
          success: false,
          error: "SaaS plan not found or inactive.",
        },
        { status: 404 }
      );
    }

    const { data: subscription, error: subscriptionError } =
      await supabase
        .from("saas_subscriptions")
        .select(
          "id, dealership_id, plan_id, status, billing_interval, current_period_start, current_period_end"
        )
        .eq("dealership_id", dealership.id)
        .maybeSingle();

    if (subscriptionError) {
      console.error(
        "Platform subscription lookup error:",
        subscriptionError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load dealership subscription.",
        },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          error: "Dealership subscription not found.",
        },
        { status: 404 }
      );
    }

    if (subscription.plan_id === plan.id) {
      return NextResponse.json({
        success: true,
        changed: false,
        subscription: {
          id: subscription.id,
          dealership_id: subscription.dealership_id,
          plan_id: subscription.plan_id,
          plan_code: plan.code,
          plan_name: plan.name,
          status: subscription.status,
        },
      });
    }

    const previousPlanId = subscription.plan_id;

    const { data: updatedSubscription, error: updateError } =
      await supabase
        .from("saas_subscriptions")
        .update({
          plan_id: plan.id,
        })
        .eq("id", subscription.id)
        .select(
          "id, dealership_id, plan_id, status, billing_interval, current_period_start, current_period_end"
        )
        .single();

    if (updateError) {
      console.error(
        "Platform subscription plan update error:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to update SaaS plan.",
        },
        { status: 500 }
      );
    }

    await writePlatformAuditLog({
      actorUserId: platformAdmin.user_id,
      action: "DEALERSHIP_PLAN_CHANGED",
      targetType: "DEALERSHIP",
      targetId: dealership.id,
      metadata: {
        dealership_name: dealership.name,
        previous_plan_id: previousPlanId,
        new_plan_id: plan.id,
        new_plan_code: plan.code,
        new_plan_name: plan.name,
      },
    });

    return NextResponse.json({
      success: true,
      changed: true,
      subscription: {
        ...updatedSubscription,
        plan_code: plan.code,
        plan_name: plan.name,
      },
    });
  } catch (error) {
    console.error(
      "Platform dealership plan API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update dealership plan.",
      },
      { status: 500 }
    );
  }
}
