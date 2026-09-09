"use client";

import { useEffect, useMemo, useState } from "react";

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

        const usageData =
          (await usageResponse.json()) as ApiResponse<unknown>;

        if (!subscriptionResponse.ok || !subscriptionData.success) {
          throw new Error(
            subscriptionData.error ||
              "Failed to load SaaS subscription."
          );
        }

        if (!usageResponse.ok || !usageData.success) {
          throw new Error(
            usageData.error ||
              "Failed to load SaaS usage."
          );
        }

        if (cancelled) return;

        setSubscription(subscriptionData.subscription ?? null);
        setUsage(usageData.usage ?? null);
      } catch (loadError) {
        if (cancelled) return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load SaaS information."
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
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-gray-500">
            Loading SaaS account...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <h1 className="text-lg font-semibold text-red-800">
            SaaS account unavailable
          </h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-6">
        <header>
          <p className="text-sm font-medium text-gray-500">
            Shiftly Auto SaaS
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
            SaaS Account
          </h1>

          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Your dealership operates as an isolated SaaS account while
            sharing the central Shiftly Auto platform, AI engine, data
            APIs, integrations, and reporting infrastructure.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Current plan
                </p>

                <h2 className="mt-1 text-2xl font-bold text-gray-900">
                  {plan?.name ?? "Unknown plan"}
                </h2>

                {plan?.description ? (
                  <p className="mt-2 text-sm text-gray-600">
                    {plan.description}
                  </p>
                ) : null}
              </div>

              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                {subscription?.status ?? "UNKNOWN"}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Plan code
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {plan?.code ?? "N/A"}
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Billing
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {subscription?.billing_interval ?? "N/A"}
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Period ends
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {formatDate(subscription?.current_period_end ?? null)}
                </p>
              </div>
            </div>

            {subscription?.trial_ends_at ? (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-900">
                  Trial period
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Trial ends {formatDate(subscription.trial_ends_at)}.
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Platform
            </p>

            <h2 className="mt-1 text-xl font-bold text-gray-900">
              Central Shiftly Auto
            </h2>

            <div className="mt-5 space-y-3">
              {[
                "Dealership isolation",
                "AI engine",
                "Vehicle data APIs",
                "CRM and integrations",
                "Reports and analytics",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 text-sm text-gray-700"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs">
                    +
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Current month usage
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Usage period: {usage?.usage_month ?? "Current month"}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {usageCards.map((item) => {
              const percent = usagePercent(item.value, item.limit);

              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        {item.label}
                      </p>

                      <p className="mt-1 text-2xl font-bold text-gray-900">
                        {item.value.toLocaleString()}
                      </p>
                    </div>

                    <p className="text-xs font-medium text-gray-500">
                      / {formatLimit(item.limit)}
                    </p>
                  </div>

                  {item.limit !== null ? (
                    <div className="mt-4">
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-gray-900"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <p className="mt-2 text-xs text-gray-500">
                        {percent}% of plan limit
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-gray-500">
                      No plan limit configured
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">
            Included features
          </h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(plan?.features ?? {}).map(
              ([feature, enabled]) => (
                <div
                  key={feature}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {feature.replaceAll("_", " ")}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {enabled ? "Enabled" : "Not included"}
                  </p>
                </div>
              )
            )}
          </div>

          {Object.keys(plan?.features ?? {}).length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              No feature entitlements configured.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
