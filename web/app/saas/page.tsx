"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BackIcon,
  SaasIcon,
  RefreshIcon,
  CheckIcon,
  XIcon,
  UsersIcon,
  VehiclesIcon,
  ReportsIcon,
  CalendarIcon,
  ShieldIcon,
  BuildingIcon,
  CreditCardIcon,
  BotIcon,
  CrmIcon,
  IntegrationsIcon,
  PlatformIcon,
  ClockIcon,
  SettingsIcon,
} from "@/components/icons";

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthly_price?: number;
  annual_price?: number;
  max_users: number | null;
  max_vehicles: number | null;
  max_reports_per_month: number | null;
  max_ai_requests_per_month: number | null;
  max_integrations: number | null;
  features: Record<string, boolean> | null;
};

type Subscription = {
  id: string;
  dealership_id: string;
  status: string;
  billing_interval: string;
  current_period_start: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  canceled_at: string | null;
  plan: Plan | null;
};

type Usage = {
  id?: string;
  dealership_id: string;
  usage_month: string;
  active_users: number;
  vehicle_count: number;
  reports_generated: number;
  ai_requests: number;
  integration_count: number;
  api_requests: number;
};

type ApiResponse<T> = {
  success: boolean;
  error?: string;
  subscription?: T;
  usage?: Usage;
};

function formatDate(value: string | null) {
  if (!value) return "No end date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No end date";
  }

  return date.toLocaleDateString();
}

function formatLimit(value: number | null) {
  return value === null ? "Unlimited" : value.toLocaleString();
}

function usagePercent(value: number, limit: number | null) {
  if (limit === null || limit <= 0) return 0;

  return Math.min(100, Math.round((value / limit) * 100));
}

export default function SaasPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSaasData() {
      try {
        setLoading(true);
        setError("");

        const [subscriptionResponse, usageResponse] = await Promise.all([
          fetch("/api/saas/subscription", {
            cache: "no-store",
          }),
          fetch("/api/saas/usage", {
            cache: "no-store",
          }),
        ]);

        const subscriptionData =
          (await subscriptionResponse.json()) as ApiResponse<Subscription>;

        const usageData = (await usageResponse.json()) as ApiResponse<unknown>;

        if (!subscriptionResponse.ok || !subscriptionData.success) {
          throw new Error(
            subscriptionData.error || "Failed to load SaaS subscription.",
          );
        }

        if (!usageResponse.ok || !usageData.success) {
          throw new Error(usageData.error || "Failed to load SaaS usage.");
        }

        if (cancelled) return;

        setSubscription(subscriptionData.subscription ?? null);
        setUsage(usageData.usage ?? null);
      } catch (loadError) {
        if (cancelled) return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load SaaS information.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSaasData();

    return () => {
      cancelled = true;
    };
  }, []);

  const plan = subscription?.plan ?? null;

  const usageCards = useMemo(() => {
    if (!usage || !plan) return [];

    return [
      {
        label: "Active users",
        value: usage.active_users,
        limit: plan.max_users,
      },
      {
        label: "Vehicles",
        value: usage.vehicle_count,
        limit: plan.max_vehicles,
      },
      {
        label: "Reports",
        value: usage.reports_generated,
        limit: plan.max_reports_per_month,
      },
      {
        label: "AI requests",
        value: usage.ai_requests,
        limit: plan.max_ai_requests_per_month,
      },
      {
        label: "Integrations",
        value: usage.integration_count,
        limit: plan.max_integrations,
      },
      {
        label: "API requests",
        value: usage.api_requests,
        limit: null,
      },
    ];
  }, [usage, plan]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
        <div className="flex items-center justify-center py-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
            <RefreshIcon className="h-5 w-5 animate-spin" />
          </span>
          <p className="ml-3 text-sm font-medium text-[#64748B]">
            Loading SaaS account...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-200 bg-red-100 text-red-600">
            <XIcon className="h-5 w-5" />
          </span>
          <h3 className="mt-4 text-base font-bold text-red-800">
            SaaS account unavailable
          </h3>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-50"
          >
            <RefreshIcon className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
      case "trialing":
        return CheckIcon;
      case "past_due":
      case "canceled":
      case "incomplete":
        return XIcon;
      default:
        return ShieldIcon;
    }
  };

  const getUsageIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case "active users":
        return UsersIcon;
      case "vehicles":
        return VehiclesIcon;
      case "reports":
        return ReportsIcon;
      case "ai requests":
        return BotIcon;
      case "integrations":
        return IntegrationsIcon;
      case "api requests":
        return PlatformIcon;
      default:
        return SettingsIcon;
    }
  };

  const getFeatureIcon = (feature: string) => {
    switch (feature.toLowerCase()) {
      case "vehicle_management":
        return VehiclesIcon;
      case "crm":
        return CrmIcon;
      case "reports":
        return ReportsIcon;
      case "integrations":
        return IntegrationsIcon;
      case "ai_features":
        return BotIcon;
      default:
        return SettingsIcon;
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
      <div className="mb-5">
        <Link
          href="/"
          className="group mb-3 inline-flex items-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-3.5 py-2 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF] hover:text-[#1677FF]"
        >
          <BackIcon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="rounded-2xl border border-[#DCE8F5] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
              <SaasIcon className="h-4 w-4" />
            </span>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">
                SaaS Management
              </p>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                SaaS Account
              </h1>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#64748B]">
                Manage your subscription, usage, billing, and plan limits.
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="mb-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
            <CreditCardIcon className="h-4 w-4" />
          </span>

          <div>
            <h2 className="text-base font-bold text-[#102A56]">
              Current Subscription
            </h2>

            <p className="text-xs text-[#64748B]">
              View your plan details and billing information
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[#334155]">Plan</p>

                <h3 className="mt-1 text-lg font-bold text-[#102A56]">
                  {plan?.name ?? "Unknown plan"}
                </h3>

                {plan?.description ? (
                  <p className="mt-1 text-sm text-[#64748B]">
                    {plan.description}
                  </p>
                ) : null}
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CFE2F5] bg-[#F5F9FD] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[#475569]">
                {getStatusIcon(subscription?.status ?? "UNKNOWN")({
                  className: "h-3 w-3",
                })}
                {subscription?.status ?? "UNKNOWN"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[#DCE8F5] bg-white p-3">
                <p className="text-xs font-semibold text-[#334155]">
                  Plan Code
                </p>

                <p className="mt-1 text-sm font-semibold text-[#102A56]">
                  {plan?.code ?? "N/A"}
                </p>
              </div>

              <div className="rounded-lg border border-[#DCE8F5] bg-white p-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-[#64748B]" />
                  <p className="text-xs font-semibold text-[#334155]">
                    Billing
                  </p>
                </div>

                <p className="mt-1 text-sm font-semibold text-[#102A56]">
                  {subscription?.billing_interval ?? "N/A"}
                </p>
              </div>

              <div className="rounded-lg border border-[#DCE8F5] bg-white p-3">
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-[#64748B]" />
                  <p className="text-xs font-semibold text-[#334155]">
                    Period Ends
                  </p>
                </div>

                <p className="mt-1 text-sm font-semibold text-[#102A56]">
                  {formatDate(subscription?.current_period_end ?? null)}
                </p>
              </div>
            </div>

            {subscription?.trial_ends_at && (
              <div className="mt-3 rounded-lg border border-[#FED7AA] bg-[#FFFBEB] p-3">
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-[#92400E]" />
                  <p className="text-xs font-semibold text-[#92400E]">
                    Trial Period
                  </p>
                </div>

                <p className="mt-1 text-sm text-[#92400E]">
                  Trial ends {formatDate(subscription.trial_ends_at)}.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                <PlatformIcon className="h-4 w-4" />
              </span>

              <div>
                <h3 className="text-base font-bold text-[#102A56]">
                  Central Shiftly Auto Platform
                </h3>

                <p className="text-xs text-[#64748B]">
                  Shared infrastructure and services
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                { icon: BuildingIcon, label: "Dealership isolation" },
                { icon: BotIcon, label: "AI engine" },
                { icon: PlatformIcon, label: "Vehicle data APIs" },
                { icon: IntegrationsIcon, label: "CRM and integrations" },
                { icon: ReportsIcon, label: "Reports and analytics" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 text-sm text-[#475569]"
                >
                  <item.icon className="h-4 w-4 text-[#1677FF]" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
              <SettingsIcon className="h-4 w-4" />
            </span>

            <div>
              <h2 className="text-base font-bold text-[#102A56]">
                Current Month Usage
              </h2>

              <p className="text-xs text-[#64748B]">
                Usage period: {usage?.usage_month ?? "Current month"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-3 text-xs font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {usageCards.map((item) => {
            const percent = usagePercent(item.value, item.limit);
            const UsageIcon = getUsageIcon(item.label);

            return (
              <div
                key={item.label}
                className="rounded-xl border border-[#DCE8F5] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                      <UsageIcon className="h-4 w-4" />
                    </span>

                    <div>
                      <p className="text-xs font-semibold text-[#334155]">
                        {item.label}
                      </p>

                      <p className="mt-0.5 text-lg font-bold text-[#102A56]">
                        {item.value.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs font-medium text-[#64748B]">
                    / {formatLimit(item.limit)}
                  </p>
                </div>

                {item.limit !== null ? (
                  <div className="mt-3">
                    <div className="h-2 overflow-hidden rounded-full bg-[#E7EEF6]">
                      <div
                        className="h-full rounded-full bg-[#1677FF]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <p className="mt-1.5 text-xs text-[#64748B]">
                      {percent}% of plan limit
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[#64748B]">
                    No plan limit configured
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
            <SettingsIcon className="h-4 w-4" />
          </span>

          <div>
            <h2 className="text-base font-bold text-[#102A56]">
              Plan Features
            </h2>

            <p className="text-xs text-[#64748B]">
              Included features in your current plan
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(plan?.features ?? {}).map(([feature, enabled]) => {
            const FeatureIcon = getFeatureIcon(feature);

            return (
              <div
                key={feature}
                className="rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-white text-[#1677FF]">
                    <FeatureIcon className="h-4 w-4" />
                  </span>

                  <div>
                    <p className="text-xs font-semibold text-[#334155]">
                      {feature.replaceAll("_", " ")}
                    </p>

                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {enabled ? "Enabled" : "Not included"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {Object.keys(plan?.features ?? {}).length === 0 && (
          <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
              <SettingsIcon className="h-5 w-5" />
            </span>

            <h3 className="mt-4 text-base font-bold text-[#102A56]">
              No features configured
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
              No feature entitlements are configured for your plan.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}




