"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";

type Customer = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
};

type Vehicle = {
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
};

type Lead = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  status: string | null;
  follow_up_date: string | null;
  created_at: string;
  customer: Customer | null;
  vehicle: Vehicle | null;
};

type Activity = {
  id: string;
  activity_type: string;
  description: string;
  activity_at: string;
  customer: {
    id: string;
    name: string | null;
  } | null;
  lead: {
    id: string;
    customer_name: string | null;
    status: string | null;
  } | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

type Report = {
  id: string;
  vehicle_id: string;
  customer_id: string | null;
  lead_id: string | null;
  created_by: string;
  share_token: string | null;
  created_at: string;
  customer_report: {
    vehicle?: Vehicle;
  } | null;
  customer: Customer | null;
  lead: {
    id: string;
    customer_name: string | null;
    status: string | null;
    follow_up_date: string | null;
    vehicle_id: string | null;
  } | null;
  salesperson: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

type DashboardData = {
  stats: {
    totalCustomers: number;
    activeLeads: number;
    followUpsDue: number;
    overdueFollowUps: number;
    todayFollowUps: number;
    reportsGenerated: number;
    activitiesToday: number;
  };
  followUps: Lead[];
  recentLeads: Lead[];
  recentActivities: Activity[];
  recentReports: Report[];
};

function formatDate(value: string | null) {
  if (!value) return "No date";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function vehicleName(vehicle: Vehicle | null | undefined) {
  if (!vehicle) return "No vehicle";

  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter(Boolean)
    .join(" ") || "Vehicle";
}

function statusClasses(status: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "NEW":
      return "bg-blue-50 text-blue-700";
    case "CONTACTED":
      return "bg-purple-50 text-purple-700";
case "WON":

  return "bg-green-50 text-green-700";

case "NEGOTIATING":
      return "bg-amber-50 text-amber-700";
case "LOST":
      return "bg-red-50 text-red-700";
default:
      return "bg-gray-100 text-gray-600";
  }
}

function activityLabel(type: string) {
  return type.replace(/_/g, " ");
}

function isOverdue(date: string | null) {
  if (!date) return false;

  const today = new Date();
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const followUp = new Date(`${date}T00:00:00`);

  return followUp < todayDate;
}

function StatCard({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: number;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </Link>
  );
}

export default function CrmDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/crm/dashboard", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setError(
            result.error || "Failed to load CRM dashboard."
          );
          return;
        }

        setDashboard(result);
      } catch (err) {
        console.error("CRM dashboard load error:", err);
        setError("Something went wrong loading the CRM dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const followUpSummary = useMemo(() => {
    if (!dashboard) {
      return {
        overdue: 0,
        today: 0,
      };
    }

    return {
      overdue: dashboard.stats.overdueFollowUps,
      today: dashboard.stats.todayFollowUps,
    };
  }, [dashboard]);

  return (
    <main className="min-h-screen bg-gray-100">
      <AppHeader />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">
              Customer Relationship Management
            </p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">
              CRM Dashboard
            </h1>
            <p className="mt-2 text-gray-600">
              Manage customers, leads, follow-ups, activities, and reports.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/customers"
              className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Add Customer
            </Link>
            <Link
              href="/leads"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Add Lead
            </Link>
            <Link
              href="/activities"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Log Activity
            </Link>
          </div>
        </div>

        {loading && (
          <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              Loading CRM dashboard...
            </p>
          </div>
        )}

        {!loading && error && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        {!loading && !error && dashboard && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                label="Customers"
                value={dashboard.stats.totalCustomers}
                detail="Customer records"
                href="/customers"
              />

              <StatCard
                label="Active Leads"
                value={dashboard.stats.activeLeads}
                detail="Open opportunities"
                href="/leads"
              />

              <StatCard
                label="Follow-ups Due"
                value={dashboard.stats.followUpsDue}
                detail={`${followUpSummary.overdue} overdue, ${followUpSummary.today} today`}
                href="/leads"
              />

              <StatCard
                label="Reports"
                value={dashboard.stats.reportsGenerated}
                detail="Reports generated"
                href="/reports"
              />

              <StatCard
                label="Activities Today"
                value={dashboard.stats.activitiesToday}
                detail="Sales activity logged"
                href="/activities"
              />
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      Follow-ups Due
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      Customers that need attention
                    </p>
                  </div>

                  <Link
                    href="/leads"
                    className="text-sm font-semibold text-gray-700 hover:text-black"
                  >
                    View Leads
                  </Link>
                </div>

                {dashboard.followUps.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500">
                    No follow-ups are due.
                  </div>
                ) : (
                  <div>
                    {dashboard.followUps.map((lead) => (
                      <Link
                        key={lead.id}
                        href="/leads"
                        className="block border-b px-5 py-4 last:border-b-0 hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">
                              {lead.customer?.name ||
                                lead.customer_name ||
                                "Customer"}
                            </p>

                            <p className="mt-1 truncate text-xs text-gray-500">
                              {vehicleName(lead.vehicle)}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusClasses(
                                lead.status
                              )}`}
                            >
                              {lead.status || "NEW"}
                            </span>

                            <p
                              className={`mt-1 text-xs font-medium ${
                                isOverdue(lead.follow_up_date)
                                  ? "text-red-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {isOverdue(lead.follow_up_date)
                                ? "Overdue"
                                : "Due"}{" "}
                              {formatDate(lead.follow_up_date)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      Recent Leads
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      Latest customer opportunities
                    </p>
                  </div>

                  <Link
                    href="/leads"
                    className="text-sm font-semibold text-gray-700 hover:text-black"
                  >
                    View All
                  </Link>
                </div>

                {dashboard.recentLeads.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500">
                    No leads have been created yet.
                  </div>
                ) : (
                  <div>
                    {dashboard.recentLeads.map((lead) => (
                      <Link
                        key={lead.id}
                        href="/leads"
                        className="block border-b px-5 py-4 last:border-b-0 hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">
                              {lead.customer?.name ||
                                lead.customer_name ||
                                "Customer"}
                            </p>

                            <p className="mt-1 truncate text-xs text-gray-500">
                              {vehicleName(lead.vehicle)}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${statusClasses(
                              lead.status
                            )}`}
                          >
                            {lead.status || "NEW"}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                          <span>
                            Created{" "}
                            {new Date(
                              lead.created_at
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>

                          {lead.follow_up_date && (
                            <span>
                              Follow-up {formatDate(lead.follow_up_date)}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      Recent Activities
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      Latest salesperson activity
                    </p>
                  </div>

                  <Link
                    href="/activities"
                    className="text-sm font-semibold text-gray-700 hover:text-black"
                  >
                    View All
                  </Link>
                </div>

                {dashboard.recentActivities.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500">
                    No activities have been logged yet.
                  </div>
                ) : (
                  <div>
                    {dashboard.recentActivities.map((activity) => (
                      <Link
                        key={activity.id}
                        href="/activities"
                        className="block border-b px-5 py-4 last:border-b-0 hover:bg-gray-50"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600">
                            {activity.activity_type.slice(0, 3)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold uppercase text-gray-500">
                                {activityLabel(
                                  activity.activity_type
                                )}
                              </span>

                              <span className="text-xs text-gray-400">
                                {formatDateTime(activity.activity_at)}
                              </span>
                            </div>

                            <p className="mt-1 font-medium text-gray-900">
                              {activity.customer?.name ||
                                activity.lead?.customer_name ||
                                "CRM activity"}
                            </p>

                            <p className="mt-1 truncate text-xs text-gray-500">
                              {activity.description}
                            </p>

                            {activity.user && (
                              <p className="mt-1 text-xs text-gray-400">
                                By{" "}
                                {activity.user.name ||
                                  activity.user.email ||
                                  "Salesperson"}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      Recent Customer Reports
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      Latest generated reports
                    </p>
                  </div>

                  <Link
                    href="/reports"
                    className="text-sm font-semibold text-gray-700 hover:text-black"
                  >
                    View All
                  </Link>
                </div>

                {dashboard.recentReports.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500">
                    No customer reports have been generated yet.
                  </div>
                ) : (
                  <div>
                    {dashboard.recentReports.map((report) => (
                      <div
                        key={report.id}
                        className="border-b px-5 py-4 last:border-b-0"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">
                              {report.customer?.name ||
                                "General vehicle report"}
                            </p>

                            <p className="mt-1 truncate text-xs text-gray-500">
                              {vehicleName(
                                report.customer_report?.vehicle
                              )}
                            </p>

                            {report.lead && (
                              <p className="mt-1 text-xs text-gray-400">
                                Lead:{" "}
                                {report.lead.customer_name ||
                                  "Customer"}
                              </p>
                            )}
                          </div>

                          <span className="shrink-0 text-xs text-gray-400">
                            {formatDateTime(report.created_at)}
                          </span>
                        </div>

                        <div className="mt-3">
                          <Link
                            href="/reports"
                            className="text-xs font-semibold text-gray-900 hover:underline"
                          >
                            View Report
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900">
                CRM Quick Actions
              </h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Link
                  href="/customers"
                  className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Customers
                </Link>

                <Link
                  href="/leads"
                  className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Leads
                </Link>

                <Link
                  href="/activities"
                  className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Activities
                </Link>

                <Link
                  href="/reports"
                  className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Reports
                </Link>

                <Link
                  href="/vehicles"
                  className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Vehicles
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}





