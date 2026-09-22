"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Usage = {
  active_users: number;
  vehicle_count: number;
  reports_generated: number;
  ai_requests: number;
  integration_count: number;
  api_requests: number;
};

type Plan = {
  id: string;
  code: string;
  name: string;
  monthly_price: number;
  annual_price: number;
};

type Subscription = {
  id: string;
  status: string;
  billing_interval: string;
  current_period_start: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  canceled_at: string | null;
};

type Account = {
  dealership: {
    id: string;
    name: string;
    subscription_plan: string | null;
    saas_status: string;
    trial_ends_at: string | null;
    saas_created_at: string;
    created_at: string;
    updated_at: string;
  };
  subscription: Subscription | null;
  plan: Plan | null;
  usage: Usage | null;
};

type Overview = {
  platform_admin: {
    user_id: string;
    role: string;
  };
  summary: {
    total_dealerships: number;
    status_counts: Record<string, number>;
    plan_counts: Record<string, number>;
    current_usage_month: string;
    usage_totals: Usage;
  };
  accounts: Account[];
};

type AuditLog = {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type AuditResponse = {
  logs: AuditLog[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

const STATUS_OPTIONS = [
  "ACTIVE",
  "TRIAL",
  "SUSPENDED",
  "CANCELED",
] as const;

const PLAN_OPTIONS = [
  "STARTER",
  "GROWTH",
  "ENTERPRISE",
] as const;

function formatDate(value: string | null) {
  if (!value) return "Not set";

  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set";

  return new Date(value).toLocaleString();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function statusClass(status: string) {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "TRIAL":
      return "border-sky-400/30 bg-sky-400/10 text-sky-300";
    case "SUSPENDED":
    case "PAST_DUE":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "CANCELED":
    case "EXPIRED":
      return "border-red-400/30 bg-red-400/10 text-red-300";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function metadataText(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata);

  if (entries.length === 0) {
    return "No metadata";
  }

  return entries
    .map(([key, value]) => {
      const formatted =
        typeof value === "string"
          ? value
          : JSON.stringify(value);

      return `${key}: ${formatted}`;
    })
    .join(" | ");
}

function formatActionLabel(action: string): string {
  const actionMap: Record<string, string> = {
    DEALERSHIP_STATUS_CHANGED: "Status changed",
    DEALERSHIP_PLAN_CHANGED: "Plan changed",
    DEALERSHIP_CREATED: "Dealership created",
    DEALERSHIP_UPDATED: "Dealership updated",
    DEALERSHIP_DELETED: "Dealership deleted",
    USER_INVITED: "User invited",
    USER_ROLE_CHANGED: "User role changed",
    USER_DELETED: "User deleted",
  };

  return actionMap[action] || action;
}

function getDealershipName(metadata: Record<string, unknown>, accounts: Account[]): string {
  const dealershipId = metadata.dealership_id as string;
  if (dealershipId) {
    const account = accounts.find(a => a.dealership.id === dealershipId);
    if (account) return account.dealership.name;
  }
  const name = metadata.dealership_name as string;
  return name || "Unknown";
}

function getActorName(actorId: string | null, accounts: Account[]): string {
  if (!actorId) return "System";
  const account = accounts.find(a => a.dealership.id === actorId);
  if (account) return account.dealership.name;
  return actorId.substring(0, 8) + "...";
}

function formatActionDetails(action: string, metadata: Record<string, unknown>): string {
  if (action === "DEALERSHIP_STATUS_CHANGED") {
    const oldStatus = metadata.old_status as string;
    const newStatus = metadata.new_status as string;
    if (oldStatus && newStatus) {
      return `${oldStatus} → ${newStatus}`;
    }
  }
  if (action === "DEALERSHIP_PLAN_CHANGED") {
    const oldPlan = metadata.old_plan as string;
    const newPlan = metadata.new_plan as string;
    if (oldPlan && newPlan) {
      return `${oldPlan} → ${newPlan}`;
    }
  }
  return metadataText(metadata);
}

export default function PlatformPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);

  const [error, setError] = useState("");
  const [auditError, setAuditError] = useState("");

  const [updatingStatus, setUpdatingStatus] = useState<string | null>(
    null
  );

  const [updatingPlan, setUpdatingPlan] = useState<string | null>(
    null
  );

  const [selectedStatuses, setSelectedStatuses] = useState<
    Record<string, string>
  >({});

  const [selectedPlans, setSelectedPlans] = useState<
    Record<string, string>
  >({});

  const [auditOffset, setAuditOffset] = useState(0);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/platform/overview", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to load platform overview."
        );
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load platform overview."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async (offset: number) => {
    try {
      setAuditLoading(true);
      setAuditError("");

      const response = await fetch(
        `/api/platform/audit-logs?limit=25&offset=${offset}`,
        {
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to load platform audit logs."
        );
      }

      setAuditData({
        logs: result.logs ?? [],
        pagination: result.pagination,
      });
    } catch (err) {
      setAuditError(
        err instanceof Error
          ? err.message
          : "Failed to load platform audit logs."
      );
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    loadAuditLogs(0);
  }, [loadOverview, loadAuditLogs]);

  const usage = data?.summary.usage_totals;

  const statusEntries = useMemo(
    () =>
      Object.entries(data?.summary.status_counts ?? {}).sort(
        (a, b) => b[1] - a[1]
      ),
    [data]
  );

  const planEntries = useMemo(
    () =>
      Object.entries(data?.summary.plan_counts ?? {}).sort(
        (a, b) => b[1] - a[1]
      ),
    [data]
  );

  const isPlatformAdmin =
    data?.platform_admin.role === "PLATFORM_ADMIN";

  const handleStatusChange = async (
    dealershipId: string,
    status: string
  ) => {
    if (!isPlatformAdmin) return;

    const account = data?.accounts.find(
      (item) => item.dealership.id === dealershipId
    );

    if (!account) return;

    if (status === account.dealership.saas_status) {
      return;
    }

    const confirmed = window.confirm(
      `Change ${account.dealership.name} status from ${account.dealership.saas_status} to ${status}?`
    );

    if (!confirmed) return;

    try {
      setUpdatingStatus(dealershipId);
      setError("");

      const response = await fetch(
        `/api/platform/dealerships/${dealershipId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to update dealership status."
        );
      }

      await loadOverview();
      await loadAuditLogs(auditOffset);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update dealership status."
      );
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handlePlanChange = async (
    dealershipId: string,
    planCode: string
  ) => {
    if (!isPlatformAdmin) return;

    const account = data?.accounts.find(
      (item) => item.dealership.id === dealershipId
    );

    if (!account) return;

    if (planCode === account.plan?.code) {
      return;
    }

    const confirmed = window.confirm(
      `Change ${account.dealership.name} plan to ${planCode}?`
    );

    if (!confirmed) return;

    try {
      setUpdatingPlan(dealershipId);
      setError("");

      const response = await fetch(
        `/api/platform/dealerships/${dealershipId}/plan`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planCode,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to update dealership plan."
        );
      }

      await loadOverview();
      await loadAuditLogs(auditOffset);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update dealership plan."
      );
    } finally {
      setUpdatingPlan(null);
    }
  };

  if (loading) {
    return (
      <>

        <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
              Loading Central Platform...
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error && !data) {
    return (
      <>

        <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-8">
              <h1 className="text-xl font-semibold">
                Central Platform
              </h1>

              <p className="mt-3 text-red-300">{error}</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <>

      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl space-y-6">
          <section>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-sky-300">
                  Shiftly Auto SaaS
                </p>

                <h1 className="mt-2 text-3xl font-bold">
                  Central Platform
                </h1>

                <p className="mt-2 max-w-2xl text-sm text-white/60">
                  Central administration for all dealership accounts,
                  subscriptions, platform usage, and audit activity.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                <span className="text-white/50">Access:</span>{" "}
                <span className="font-medium text-white">
                  {data.platform_admin.role}
                </span>

                {!isPlatformAdmin && (
                  <p className="mt-1 text-xs text-amber-300">
                    Read-only access
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm text-white/50">Dealerships</p>
              <p className="mt-2 text-3xl font-bold">
                {formatNumber(data.summary.total_dealerships)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm text-white/50">Active Users</p>
              <p className="mt-2 text-3xl font-bold">
                {formatNumber(usage?.active_users ?? 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm text-white/50">Vehicles</p>
              <p className="mt-2 text-3xl font-bold">
                {formatNumber(usage?.vehicle_count ?? 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm text-white/50">AI Requests</p>
              <p className="mt-2 text-3xl font-bold">
                {formatNumber(usage?.ai_requests ?? 0)}
              </p>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold">
                Account Status
              </h2>

              <div className="mt-5 space-y-3">
                {statusEntries.length === 0 ? (
                  <p className="text-sm text-white/50">
                    No account status data.
                  </p>
                ) : (
                  statusEntries.map(([status, count]) => (
                    <div
                      key={status}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-4 py-3"
                    >
                      <div className="flex flex-col">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClass(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                        <span className="mt-1 text-xs text-white/50">
                          {count === 1 ? '1 dealership' : `${count} dealerships`}
                        </span>
                      </div>

                      <span className="font-semibold">
                        {formatNumber(count)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold">
                Subscription Plans
              </h2>

              <div className="mt-5 space-y-3">
                {planEntries.length === 0 ? (
                  <p className="text-sm text-white/50">
                    No subscription plan data.
                  </p>
                ) : (
                  planEntries.map(([plan, count]) => (
                    <div
                      key={plan}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-4 py-3"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {plan}
                        </span>
                        <span className="mt-1 text-xs text-white/50">
                          {count === 1 ? '1 dealership' : `${count} dealerships`}
                        </span>
                      </div>

                      <span className="font-semibold">
                        {formatNumber(count)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div>
              <h2 className="text-lg font-semibold">
                Platform Usage
              </h2>

              <p className="mt-1 text-sm text-white/50">
                Aggregated usage for{" "}
                {data.summary.current_usage_month}.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 p-4">
                <p className="text-xs text-white/50">
                  Reports
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatNumber(
                    usage?.reports_generated ?? 0
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 p-4">
                <p className="text-xs text-white/50">
                  Integrations
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatNumber(
                    usage?.integration_count ?? 0
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 p-4">
                <p className="text-xs text-white/50">
                  API Requests
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatNumber(usage?.api_requests ?? 0)}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 p-4">
                <p className="text-xs text-white/50">
                  AI Requests
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatNumber(usage?.ai_requests ?? 0)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Dealership Accounts
                </h2>

                <p className="mt-1 text-sm text-white/50">
                  Manage dealership SaaS lifecycle and subscription
                  plans from the central platform.
                </p>
              </div>

              {!isPlatformAdmin && (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
                  Read-only
                </span>
              )}
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className="px-4 py-3 font-medium">
                      Dealership
                    </th>
                    <th className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th className="px-4 py-3 font-medium">
                      Plan
                    </th>
                    <th className="px-4 py-3 font-medium">
                      Users
                    </th>
                    <th className="px-4 py-3 font-medium">
                      Vehicles
                    </th>
                    <th className="px-4 py-3 font-medium">
                      Reports
                    </th>
                    <th className="px-4 py-3 font-medium">
                      Created
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {data.accounts.map((account) => {
                    const dealershipId = account.dealership.id;

                    const selectedStatus =
                      selectedStatuses[dealershipId] ??
                      account.dealership.saas_status;

                    const selectedPlan =
                      selectedPlans[dealershipId] ??
                      account.plan?.code ??
                      "STARTER";

                    const statusBusy =
                      updatingStatus === dealershipId;

                    const planBusy =
                      updatingPlan === dealershipId;

                    return (
                      <tr
                        key={dealershipId}
                        className="border-b border-white/5"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {account.dealership.name}
                          </div>

                          <div className="mt-1 text-xs text-white/35">
                            {dealershipId.substring(0, 8)}...
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            <span
                              className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${statusClass(
                                account.dealership.saas_status
                              )}`}
                            >
                              {account.dealership.saas_status}
                            </span>

                            {isPlatformAdmin && (
                              <div className="flex items-center gap-2">
                                <select
                                  value={selectedStatus}
                                  disabled={statusBusy}
                                  onChange={(event) =>
                                    setSelectedStatuses((current) => ({
                                      ...current,
                                      [dealershipId]:
                                        event.target.value,
                                    }))
                                  }
                                  className="h-9 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
                                >
                                  {STATUS_OPTIONS.map((status) => (
                                    <option
                                      key={status}
                                      value={status}
                                    >
                                      {status}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  disabled={
                                    statusBusy ||
                                    selectedStatus ===
                                      account.dealership.saas_status
                                  }
                                  onClick={() =>
                                    handleStatusChange(
                                      dealershipId,
                                      selectedStatus
                                    )
                                  }
                                  className="h-9 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {statusBusy
                                    ? "Updating..."
                                    : "Apply"}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            <span>
                              {account.plan?.name ?? "Not assigned"}
                            </span>

                            {isPlatformAdmin && (
                              <div className="flex items-center gap-2">
                                <select
                                  value={selectedPlan}
                                  disabled={planBusy}
                                  onChange={(event) =>
                                    setSelectedPlans((current) => ({
                                      ...current,
                                      [dealershipId]:
                                        event.target.value,
                                    }))
                                  }
                                  className="h-9 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
                                >
                                  {PLAN_OPTIONS.map((plan) => (
                                    <option
                                      key={plan}
                                      value={plan}
                                    >
                                      {plan}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  disabled={
                                    planBusy ||
                                    selectedPlan ===
                                      account.plan?.code
                                  }
                                  onClick={() =>
                                    handlePlanChange(
                                      dealershipId,
                                      selectedPlan
                                    )
                                  }
                                  className="h-9 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {planBusy
                                    ? "Updating..."
                                    : "Apply"}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {formatNumber(
                            account.usage?.active_users ?? 0
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {formatNumber(
                            account.usage?.vehicle_count ?? 0
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {formatNumber(
                            account.usage?.reports_generated ?? 0
                          )}
                        </td>

                        <td className="px-4 py-3 text-white/60">
                          {formatDate(
                            account.dealership.saas_created_at
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {data.accounts.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-white/50"
                      >
                        No dealerships found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Platform Audit Log
                </h2>

                <p className="mt-1 text-sm text-white/50">
                  Central record of platform administration activity.
                </p>
              </div>

              {auditData && (
                <span className="text-xs text-white/40">
                  {formatNumber(
                    auditData.pagination.total
                  )}{" "}
                  total events
                </span>
              )}
            </div>

            {auditError && (
              <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
                {auditError}
              </div>
            )}

            <div className="mt-5 overflow-x-auto">
              {auditLoading ? (
                <div className="rounded-xl border border-white/10 p-6 text-sm text-white/50">
                  Loading audit logs...
                </div>
              ) : (
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50">
                      <th className="px-4 py-3 font-medium">
                        Date
                      </th>
                      <th className="px-4 py-3 font-medium">
                        Action
                      </th>
                      <th className="px-4 py-3 font-medium">
                        Target
                      </th>
                      <th className="px-4 py-3 font-medium">
                        Actor
                      </th>
                      <th className="px-4 py-3 font-medium">
                        Metadata
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {(auditData?.logs ?? []).map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-white/5"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-white/60">
                          {formatDateTime(log.created_at)}
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300">
                            {formatActionLabel(log.action)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {getDealershipName(log.metadata, data.accounts)}
                          </div>

                          {log.target_id && (
                            <div className="mt-1 text-xs text-white/35">
                              {log.target_id.substring(0, 8)}...
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-xs text-white/60">
                          {getActorName(log.actor_user_id, data.accounts)}
                        </td>

                        <td className="max-w-xl px-4 py-3 text-xs text-white/50">
                          <div className="break-words">
                            {formatActionDetails(log.action, log.metadata)}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {(auditData?.logs ?? []).length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-10 text-center text-white/50"
                        >
                          No platform audit events found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {auditData && auditData.pagination.total > 0 && (
              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  disabled={
                    auditOffset === 0 || auditLoading
                  }
                  onClick={() => {
                    const nextOffset = Math.max(
                      0,
                      auditOffset - 25
                    );

                    setAuditOffset(nextOffset);
                    loadAuditLogs(nextOffset);
                  }}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="text-xs text-white/40">
                  Showing {auditOffset + 1}-
                  {Math.min(
                    auditOffset + 25,
                    auditData.pagination.total
                  )}{" "}
                  of {auditData.pagination.total}
                </span>

                <button
                  type="button"
                  disabled={
                    !auditData.pagination.hasMore ||
                    auditLoading
                  }
                  onClick={() => {
                    const nextOffset = auditOffset + 25;

                    setAuditOffset(nextOffset);
                    loadAuditLogs(nextOffset);
                  }}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}




