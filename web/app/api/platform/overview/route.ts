import { NextResponse } from "next/server";

import {
  createSupabaseServiceRoleClient,
  getCurrentPlatformAdmin,
} from "@/lib/platform";

export async function GET() {
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

    const supabase = createSupabaseServiceRoleClient();

    const [
      dealershipsResult,
      subscriptionsResult,
      usageResult,
    ] = await Promise.all([
      supabase
        .from("dealerships")
        .select(
          "id, name, subscription_plan, saas_status, trial_ends_at, saas_created_at, created_at, updated_at"
        )
        .order("created_at", { ascending: false }),

      supabase
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
          plan:saas_plans (
            id,
            code,
            name,
            monthly_price,
            annual_price
          )
        `),

      supabase
        .from("saas_usage")
        .select(`
          id,
          dealership_id,
          usage_month,
          active_users,
          vehicle_count,
          reports_generated,
          ai_requests,
          integration_count,
          api_requests
        `)
        .order("usage_month", { ascending: false }),
    ]);

    if (dealershipsResult.error) {
      console.error(
        "Platform dealerships lookup error:",
        dealershipsResult.error
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load dealerships.",
        },
        { status: 500 }
      );
    }

    if (subscriptionsResult.error) {
      console.error(
        "Platform subscriptions lookup error:",
        subscriptionsResult.error
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load subscriptions.",
        },
        { status: 500 }
      );
    }

    if (usageResult.error) {
      console.error(
        "Platform usage lookup error:",
        usageResult.error
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load SaaS usage.",
        },
        { status: 500 }
      );
    }

    const dealerships = dealershipsResult.data ?? [];
    const subscriptions = subscriptionsResult.data ?? [];
    const usage = usageResult.data ?? [];

    const statusCounts = dealerships.reduce(
      (counts, dealership) => {
        const status = dealership.saas_status ?? "UNKNOWN";

        counts[status] = (counts[status] ?? 0) + 1;

        return counts;
      },
      {} as Record<string, number>
    );

    const planCounts = subscriptions.reduce(
      (counts, subscription) => {
        const plan = Array.isArray(subscription.plan)
          ? subscription.plan[0]
          : subscription.plan;

        const code = plan?.code ?? "UNKNOWN";

        counts[code] = (counts[code] ?? 0) + 1;

        return counts;
      },
      {} as Record<string, number>
    );

    const currentMonth = new Date();
    const usageMonth = `${currentMonth.getUTCFullYear()}-${String(
      currentMonth.getUTCMonth() + 1
    ).padStart(2, "0")}-01`;

    const currentUsage = usage.filter(
      (item) => item.usage_month === usageMonth
    );

    const usageTotals = currentUsage.reduce(
      (totals, item) => {
        totals.active_users += item.active_users ?? 0;
        totals.vehicle_count += item.vehicle_count ?? 0;
        totals.reports_generated += item.reports_generated ?? 0;
        totals.ai_requests += item.ai_requests ?? 0;
        totals.integration_count += item.integration_count ?? 0;
        totals.api_requests += item.api_requests ?? 0;

        return totals;
      },
      {
        active_users: 0,
        vehicle_count: 0,
        reports_generated: 0,
        ai_requests: 0,
        integration_count: 0,
        api_requests: 0,
      }
    );

    const subscriptionByDealership = new Map(
      subscriptions.map((subscription) => [
        subscription.dealership_id,
        subscription,
      ])
    );

    const usageByDealership = new Map(
      currentUsage.map((item) => [
        item.dealership_id,
        item,
      ])
    );

    const accounts = dealerships.map((dealership) => {
      const subscription = subscriptionByDealership.get(
        dealership.id
      );

      const usageRecord = usageByDealership.get(
        dealership.id
      );

      const plan = subscription
        ? Array.isArray(subscription.plan)
          ? subscription.plan[0] ?? null
          : subscription.plan
        : null;

      return {
        dealership: {
          id: dealership.id,
          name: dealership.name,
          subscription_plan: dealership.subscription_plan,
          saas_status: dealership.saas_status,
          trial_ends_at: dealership.trial_ends_at,
          saas_created_at: dealership.saas_created_at,
          created_at: dealership.created_at,
          updated_at: dealership.updated_at,
        },
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              billing_interval: subscription.billing_interval,
              current_period_start:
                subscription.current_period_start,
              current_period_end:
                subscription.current_period_end,
              trial_ends_at: subscription.trial_ends_at,
              canceled_at: subscription.canceled_at,
            }
          : null,
        plan,
        usage: usageRecord ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      platform_admin: {
        user_id: platformAdmin.user_id,
        role: platformAdmin.role,
      },
      summary: {
        total_dealerships: dealerships.length,
        status_counts: statusCounts,
        plan_counts: planCounts,
        current_usage_month: usageMonth,
        usage_totals: usageTotals,
      },
      accounts,
    });
  } catch (error) {
    console.error("Platform overview API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load platform overview.",
      },
      { status: 500 }
    );
  }
}
