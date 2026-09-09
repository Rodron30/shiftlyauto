import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

export type SaasPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  max_users: number | null;
  max_vehicles: number | null;
  max_reports_per_month: number | null;
  max_ai_requests_per_month: number | null;
  max_integrations: number | null;
  features: Record<string, boolean>;
};

export type SaasSubscription = {
  id: string;
  dealership_id: string;
  status:
    | "TRIAL"
    | "ACTIVE"
    | "PAST_DUE"
    | "PAUSED"
    | "CANCELED"
    | "EXPIRED";
  billing_interval: "MONTHLY" | "ANNUAL";
  current_period_start: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  canceled_at: string | null;
  plan: SaasPlan | null;
};

export type SaasDealershipStatus =
  | "ACTIVE"
  | "TRIAL"
  | "SUSPENDED"
  | "CANCELED";

export type SaasContext = {
  dealershipId: string;
  dealershipStatus: SaasDealershipStatus;
  subscription: SaasSubscription;
  plan: SaasPlan;
};

export type SaasLimitKey =
  | "users"
  | "vehicles"
  | "reports"
  | "ai_requests"
  | "integrations";

export function isSaasAccessAllowed(
  context: SaasContext
): boolean {
  const dealershipAllowed =
    context.dealershipStatus === "ACTIVE" ||
    context.dealershipStatus === "TRIAL";

  const subscriptionAllowed =
    context.subscription.status === "ACTIVE" ||
    context.subscription.status === "TRIAL";

  return dealershipAllowed && subscriptionAllowed;
}

export function getSaasLimit(
  plan: SaasPlan,
  key: SaasLimitKey
): number | null {
  switch (key) {
    case "users":
      return plan.max_users;

    case "vehicles":
      return plan.max_vehicles;

    case "reports":
      return plan.max_reports_per_month;

    case "ai_requests":
      return plan.max_ai_requests_per_month;

    case "integrations":
      return plan.max_integrations;

    default:
      return null;
  }
}

export function isSaasLimitReached(
  currentCount: number,
  limit: number | null
): boolean {
  return limit !== null && currentCount >= limit;
}

export function isSaasLimitExceeded(
  currentCount: number,
  additionalCount: number,
  limit: number | null
): boolean {
  if (limit === null) {
    return false;
  }

  return currentCount + additionalCount > limit;
}

export function getSaasLimitError(
  resource: string,
  limit: number
): string {
  return `${resource} limit reached for your current SaaS plan. Maximum allowed: ${limit}.`;
}

export function getSaasAccessError(): string {
  return "Your dealership SaaS subscription is not active.";
}

export async function getCurrentSaasContext(): Promise<
  SaasContext | null
> {
  const profile = await getCurrentUserProfile();

  if (!profile?.id || !profile.dealership_id) {
    return null;
  }

  const supabase = await createSupabaseServerClient();

  const { data: dealership, error: dealershipError } =
    await supabase
      .from("dealerships")
      .select("id, saas_status")
      .eq("id", profile.dealership_id)
      .maybeSingle();

  if (dealershipError || !dealership) {
    console.error(
      "getCurrentSaasContext dealership error:",
      dealershipError
    );

    return null;
  }

  const { data: subscription, error: subscriptionError } =
    await supabase
      .from("saas_subscriptions")
      .select(
        `
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
        `
      )
      .eq("dealership_id", profile.dealership_id)
      .maybeSingle();

  if (subscriptionError || !subscription) {
    console.error(
      "getCurrentSaasContext subscription error:",
      subscriptionError
    );

    return null;
  }

  const plan = Array.isArray(subscription.plan)
    ? subscription.plan[0]
    : subscription.plan;

  if (!plan) {
    console.error(
      "getCurrentSaasContext: subscription has no plan"
    );

    return null;
  }

  return {
    dealershipId: profile.dealership_id,
    dealershipStatus:
      dealership.saas_status as SaasDealershipStatus,
    subscription: {
      ...subscription,
      plan: plan as SaasPlan,
    } as SaasSubscription,
    plan: plan as SaasPlan,
  };
}

export async function requireSaasAccess(): Promise<
  | {
      ok: true;
      context: SaasContext;
    }
  | {
      ok: false;
      status: 401 | 403 | 500;
      error: string;
    }
> {
  const profile = await getCurrentUserProfile();

  if (!profile?.id || !profile.dealership_id) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  const context = await getCurrentSaasContext();

  if (!context) {
    return {
      ok: false,
      status: 500,
      error: "Unable to load SaaS subscription.",
    };
  }

  if (!isSaasAccessAllowed(context)) {
    return {
      ok: false,
      status: 403,
      error: getSaasAccessError(),
    };
  }

  return {
    ok: true,
    context,
  };
}