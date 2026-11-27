"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BackIcon,
  CrmIcon,
  RefreshIcon,
  XIcon,
  UserPlusIcon,
  PlusIcon,
  CalendarCheckIcon,
  ClockIcon,
  UserIcon,
  CarIcon,
  FileTextIcon,
  BellIcon,
  ExternalLinkIcon,
} from "@/components/icons";

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

  return (
    [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
      .filter(Boolean)
      .join(" ") || "Vehicle"
  );
}

function statusClasses(status: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "NEW":
      return "border border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]";
    case "CONTACTED":
      return "border border-[#E9D5FF] bg-[#FAF5FF] text-[#7C3AED]";
    case "WON":
      return "border border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]";
    case "NEGOTIATING":
      return "border border-[#FED7AA] bg-[#FFFBEB] text-[#92400E]";
    case "LOST":
      return "border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]";
    default:
      return "border border-[#CFE2F5] bg-[#F5F9FD] text-[#475569]";
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
    today.getDate(),
  );

  const followUp = new Date(`${date}T00:00:00`);

  return followUp < todayDate;
}

export default function CrmDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);

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
          setError(result.error || "Failed to load CRM dashboard.");
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

  useEffect(() => {
    async function checkRole() {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();
        setUserRole(data.profile?.role || null);
      } catch (err) {
        console.error("Failed to check user role:", err);
      }
    }
    checkRole();
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                  <CrmIcon className="h-4 w-4" />
                </span>

                <h1 className="text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                  CRM
                </h1>
              </div>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#64748B]">
                Manage customers, leads, follow-ups, activities, and reports.
              </p>
            </div>

            {userRole !== null && (
              <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                <Link
                  href="/customers"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                >
                  <UserPlusIcon className="h-4 w-4" />
                  Add Customer
                </Link>
                <Link
                  href="/leads"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8]"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Lead
                </Link>
                {userRole !== "customer" && (
                  <Link
                    href="/activities"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                  >
                    <CalendarCheckIcon className="h-4 w-4" />
                    Log Activity
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
            <RefreshIcon className="h-5 w-5 animate-spin" />
          </span>
          <p className="ml-3 text-sm font-medium text-[#64748B]">
            Loading CRM dashboard...
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-white p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600">
            <XIcon className="h-5 w-5" />
          </span>

          <h3 className="mt-4 text-base font-bold text-[#102A56]">
            Unable to load CRM dashboard
          </h3>

          <p className="mt-1 text-sm text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && dashboard && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Link
              href="/customers"
              className="group flex items-center gap-4 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5 transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF] group-hover:bg-[#1677FF] group-hover:text-white transition-colors">
                <UserIcon className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Customers
                </p>

                <p className="mt-1 text-2xl font-bold text-[#102A56]">
                  {dashboard.stats.totalCustomers}
                </p>

                <p className="mt-1 text-xs text-[#64748B]">Customer records</p>
              </div>
            </Link>

            <Link
              href="/leads"
              className="group flex items-center gap-4 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5 transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF] group-hover:bg-[#1677FF] group-hover:text-white transition-colors">
                <UserIcon className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Active Leads
                </p>

                <p className="mt-1 text-2xl font-bold text-[#102A56]">
                  {dashboard.stats.activeLeads}
                </p>

                <p className="mt-1 text-xs text-[#64748B]">
                  Open opportunities
                </p>
              </div>
            </Link>

            <Link
              href="/leads"
              className="group flex items-center gap-4 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5 transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF] group-hover:bg-[#1677FF] group-hover:text-white transition-colors">
                <ClockIcon className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Follow-ups Due
                </p>

                <p className="mt-1 text-2xl font-bold text-[#102A56]">
                  {dashboard.stats.followUpsDue}
                </p>

                <p className="mt-1 text-xs text-[#64748B]">
                  {followUpSummary.overdue} overdue, {followUpSummary.today}{" "}
                  today
                </p>
              </div>
            </Link>

            <Link
              href="/reports"
              className="group flex items-center gap-4 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5 transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF] group-hover:bg-[#1677FF] group-hover:text-white transition-colors">
                <FileTextIcon className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Reports
                </p>

                <p className="mt-1 text-2xl font-bold text-[#102A56]">
                  {dashboard.stats.reportsGenerated}
                </p>

                <p className="mt-1 text-xs text-[#64748B]">Reports generated</p>
              </div>
            </Link>

            {userRole !== "customer" && (
              <Link
                href="/activities"
                className="group flex items-center gap-4 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5 transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF] group-hover:bg-[#1677FF] group-hover:text-white transition-colors">
                  <BellIcon className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
                    Activities Today
                  </p>

                  <p className="mt-1 text-2xl font-bold text-[#102A56]">
                    {dashboard.stats.activitiesToday}
                  </p>

                  <p className="mt-1 text-xs text-[#64748B]">
                    Sales activity logged
                  </p>
                </div>
              </Link>
            )}
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                    <ClockIcon className="h-4 w-4" />
                  </span>

                  <div>
                    <h2 className="text-base font-bold text-[#102A56]">
                      Follow-ups Due
                    </h2>

                    <p className="text-xs text-[#64748B]">
                      Customers that need attention
                    </p>
                  </div>
                </div>

                <Link
                  href="/leads"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#1677FF]"
                >
                  View Leads
                </Link>
              </div>

              {dashboard.followUps.length === 0 ? (
                <div className="rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-6 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-white text-[#1677FF]">
                    <ClockIcon className="h-5 w-5" />
                  </span>

                  <h3 className="mt-4 text-sm font-bold text-[#102A56]">
                    No follow-ups due
                  </h3>

                  <p className="mt-1 text-sm text-[#64748B]">
                    All caught up! No follow-ups are currently due.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboard.followUps.map((lead) => (
                    <Link
                      key={lead.id}
                      href="/leads"
                      className="block rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5 transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                              <UserIcon className="h-4 w-4" />
                            </span>

                            <p className="truncate text-sm font-semibold text-[#102A56]">
                              {lead.customer?.name ||
                                lead.customer_name ||
                                "Customer"}
                            </p>
                          </div>

                          <p className="mt-2 truncate text-xs text-[#64748B]">
                            {vehicleName(lead.vehicle)}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                              lead.status,
                            )}`}
                          >
                            {lead.status || "NEW"}
                          </span>

                          <p
                            className={`text-xs font-medium ${
                              isOverdue(lead.follow_up_date)
                                ? "text-red-600"
                                : "text-[#64748B]"
                            }`}
                          >
                            {isOverdue(lead.follow_up_date) ? "Overdue" : "Due"}{" "}
                            {formatDate(lead.follow_up_date)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                    <UserIcon className="h-4 w-4" />
                  </span>

                  <div>
                    <h2 className="text-base font-bold text-[#102A56]">
                      Recent Leads
                    </h2>

                    <p className="text-xs text-[#64748B]">
                      Latest customer opportunities
                    </p>
                  </div>
                </div>

                <Link
                  href="/leads"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#1677FF]"
                >
                  View All
                </Link>
              </div>

              {dashboard.recentLeads.length === 0 ? (
                <div className="rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-6 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-white text-[#1677FF]">
                    <UserIcon className="h-5 w-5" />
                  </span>

                  <h3 className="mt-4 text-sm font-bold text-[#102A56]">
                    No leads yet
                  </h3>

                  <p className="mt-1 text-sm text-[#64748B]">
                    Create your first lead to start tracking opportunities.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboard.recentLeads.map((lead) => (
                    <Link
                      key={lead.id}
                      href="/leads"
                      className="block rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5 transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                              <UserIcon className="h-4 w-4" />
                            </span>

                            <p className="truncate text-sm font-semibold text-[#102A56]">
                              {lead.customer?.name ||
                                lead.customer_name ||
                                "Customer"}
                            </p>
                          </div>

                          <p className="mt-2 truncate text-xs text-[#64748B]">
                            {vehicleName(lead.vehicle)}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                            lead.status,
                          )}`}
                        >
                          {lead.status || "NEW"}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <span className="flex items-center gap-1.5 text-xs text-[#64748B]">
                          <ClockIcon className="h-3.5 w-3.5" />
                          Created{" "}
                          {new Date(lead.created_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </span>

                        {lead.follow_up_date && (
                          <span className="flex items-center gap-1.5 text-xs text-[#64748B]">
                            <ClockIcon className="h-3.5 w-3.5" />
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

          {userRole !== "customer" && (
            <section className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                      <BellIcon className="h-4 w-4" />
                    </span>

                    <div>
                      <h2 className="text-base font-bold text-[#102A56]">
                        Recent Activities
                      </h2>

                      <p className="text-xs text-[#64748B]">
                        Latest salesperson activity
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/activities"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#1677FF]"
                  >
                    View All
                  </Link>
                </div>

                {dashboard.recentActivities.length === 0 ? (
                  <div className="rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-6 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-white text-[#1677FF]">
                      <BellIcon className="h-5 w-5" />
                    </span>

                    <h3 className="mt-4 text-sm font-bold text-[#102A56]">
                      No activities yet
                    </h3>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Log sales activities to track customer interactions.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboard.recentActivities.map((activity) => (
                      <Link
                        key={activity.id}
                        href="/activities"
                        className="block rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5 transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                            <BellIcon className="h-4 w-4" />
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold uppercase text-[#64748B]">
                                {activityLabel(activity.activity_type)}
                              </span>

                              <span className="flex items-center gap-1.5 text-xs text-[#64748B]">
                                <ClockIcon className="h-3.5 w-3.5" />
                                {formatDateTime(activity.activity_at)}
                              </span>
                            </div>

                            <p className="mt-2 text-sm font-semibold text-[#102A56]">
                              {activity.customer?.name ||
                                activity.lead?.customer_name ||
                                "CRM activity"}
                            </p>

                            <p className="mt-1.5 truncate text-xs text-[#64748B]">
                              {activity.description}
                            </p>

                            {activity.user && (
                              <p className="mt-2 flex items-center gap-1.5 text-xs text-[#64748B]">
                                <UserIcon className="h-3.5 w-3.5" />
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

              <div className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                      <FileTextIcon className="h-4 w-4" />
                    </span>

                    <div>
                      <h2 className="text-base font-bold text-[#102A56]">
                        Recent Customer Reports
                      </h2>

                      <p className="text-xs text-[#64748B]">
                        Latest generated reports
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/reports"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#1677FF]"
                  >
                    View All
                  </Link>
                </div>

                {dashboard.recentReports.length === 0 ? (
                  <div className="rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-6 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-white text-[#1677FF]">
                      <FileTextIcon className="h-5 w-5" />
                    </span>

                    <h3 className="mt-4 text-sm font-bold text-[#102A56]">
                      No reports yet
                    </h3>

                    <p className="mt-1 text-sm text-[#64748B]">
                      Generate vehicle reports to share with customers.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboard.recentReports.map((report) => (
                      <div
                        key={report.id}
                        className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                                <CarIcon className="h-4 w-4" />
                              </span>

                              <p className="truncate text-sm font-semibold text-[#102A56]">
                                {report.customer?.name ||
                                  "General vehicle report"}
                              </p>
                            </div>

                            <p className="mt-2 truncate text-xs text-[#64748B]">
                              {vehicleName(report.customer_report?.vehicle)}
                            </p>

                            {report.lead && (
                              <p className="mt-1.5 text-xs text-[#64748B]">
                                Lead: {report.lead.customer_name || "Customer"}
                              </p>
                            )}
                          </div>

                          <span className="shrink-0 text-xs text-[#64748B]">
                            {formatDateTime(report.created_at)}
                          </span>
                        </div>

                        <div className="mt-3">
                          <Link
                            href="/reports"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1677FF] hover:underline"
                          >
                            <ExternalLinkIcon className="h-3.5 w-3.5" />
                            View Report
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {userRole === "customer" && (
            <section className="mt-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                    <FileTextIcon className="h-4 w-4" />
                  </span>

                  <div>
                    <h2 className="text-base font-bold text-[#102A56]">
                      Recent Customer Reports
                    </h2>

                    <p className="text-xs text-[#64748B]">
                      Latest generated reports
                    </p>
                  </div>
                </div>

                <Link
                  href="/reports"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#1677FF]"
                >
                  View All
                </Link>
              </div>

              {dashboard.recentReports.length === 0 ? (
                <div className="rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-6 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-white text-[#1677FF]">
                    <FileTextIcon className="h-5 w-5" />
                  </span>

                  <h3 className="mt-4 text-sm font-bold text-[#102A56]">
                    No reports yet
                  </h3>

                  <p className="mt-1 text-sm text-[#64748B]">
                    Your vehicle reports will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboard.recentReports.map((report) => (
                    <div
                      key={report.id}
                      className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                              <CarIcon className="h-4 w-4" />
                            </span>

                            <p className="truncate text-sm font-semibold text-[#102A56]">
                              {report.customer?.name ||
                                "General vehicle report"}
                            </p>
                          </div>

                          <p className="mt-2 truncate text-xs text-[#64748B]">
                            {vehicleName(report.customer_report?.vehicle)}
                          </p>

                          {report.lead && (
                            <p className="mt-1.5 text-xs text-[#64748B]">
                              Lead: {report.lead.customer_name || "Customer"}
                            </p>
                          )}
                        </div>

                        <span className="shrink-0 text-xs text-[#64748B]">
                          {formatDateTime(report.created_at)}
                        </span>
                      </div>

                      <div className="mt-3">
                        <Link
                          href="/reports"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1677FF] hover:underline"
                        >
                          <ExternalLinkIcon className="h-3.5 w-3.5" />
                          View Report
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {userRole !== "customer" && (
            <section className="mt-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                  <CrmIcon className="h-4 w-4" />
                </span>

                <div>
                  <h2 className="text-base font-bold text-[#102A56]">
                    CRM Quick Actions
                  </h2>

                  <p className="text-xs text-[#64748B]">
                    Navigate to key CRM modules
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Link
                  href="/customers"
                  className="group flex items-center gap-3 rounded-2xl border border-[#DCE8F5] bg-[#F8FBFF] px-4 py-3.5 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-white hover:text-[#1677FF]"
                >
                  <UserIcon className="h-5 w-5 text-[#64748B] group-hover:text-[#1677FF] transition-colors" />
                  Customers
                </Link>

                <Link
                  href="/leads"
                  className="group flex items-center gap-3 rounded-2xl border border-[#DCE8F5] bg-[#F8FBFF] px-4 py-3.5 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-white hover:text-[#1677FF]"
                >
                  <UserIcon className="h-5 w-5 text-[#64748B] group-hover:text-[#1677FF] transition-colors" />
                  Leads
                </Link>

                <Link
                  href="/activities"
                  className="group flex items-center gap-3 rounded-2xl border border-[#DCE8F5] bg-[#F8FBFF] px-4 py-3.5 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-white hover:text-[#1677FF]"
                >
                  <BellIcon className="h-5 w-5 text-[#64748B] group-hover:text-[#1677FF] transition-colors" />
                  Activities
                </Link>

                <Link
                  href="/reports"
                  className="group flex items-center gap-3 rounded-2xl border border-[#DCE8F5] bg-[#F8FBFF] px-4 py-3.5 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-white hover:text-[#1677FF]"
                >
                  <FileTextIcon className="h-5 w-5 text-[#64748B] group-hover:text-[#1677FF] transition-colors" />
                  Reports
                </Link>

                <Link
                  href="/vehicles"
                  className="group flex items-center gap-3 rounded-2xl border border-[#DCE8F5] bg-[#F8FBFF] px-4 py-3.5 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-white hover:text-[#1677FF]"
                >
                  <CarIcon className="h-5 w-5 text-[#64748B] group-hover:text-[#1677FF] transition-colors" />
                  Vehicles
                </Link>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
