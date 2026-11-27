"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerReportPayload } from "@/lib/reportTypes";

type Vehicle = {
  id: string;
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  status?: string | null;
  price?: number | null;
  mileage?: number | null;
  created_at?: string;
};

type Report = {
  id: string;
  share_token: string | null;
  created_at: string;
  customer_report: CustomerReportPayload;
};

type DuplicateInfo = {
  vin: string;
  checkedByName: string | null;
  updatedAt: string | null;
};

type DashboardStats = {
  totalCustomers: number;
  activeLeads: number;
  followUpsDue: number;
  overdueFollowUps: number;
  todayFollowUps: number;
  reportsGenerated: number;
  activitiesToday: number;
};

type Activity = {
  id: string;
  activity_type: string;
  description: string;
  activity_at: string;
  customer?: { name: string };
  lead?: { customer_name: string; status: string };
  user?: { name: string };
};

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: string;
  className?: string;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
  };

  const paths: Record<string, React.ReactNode> = {
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    users: (
      <>
        <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
        <circle cx="9.5" cy="7" r="3.5" />
        <path d="M16 4.5a3.5 3.5 0 0 1 0 6.8" />
        <path d="M17 14.5a4 4 0 0 1 4 4V20" />
      </>
    ),
    leads: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3A4.5 4.5 0 0 1 15 18.5V20" />
        <path d="M18 8v6" />
        <path d="M15 11h6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M7 2.5v4M17 2.5v4M3 9h18" />
        <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
      </>
    ),
    report: (
      <>
        <path d="M6 2.5h9l4 4V21.5H6z" />
        <path d="M15 2.5v5h4M9 12h6M9 16h6M9 8h2" />
      </>
    ),
    car: (
      <>
        <path d="m5 11 1.7-5h10.6L19 11" />
        <path d="M3.5 11h17v7h-17z" />
        <path d="M6 18v2M18 18v2M3.5 14h2M18.5 14h2" />
        <circle cx="7" cy="15" r="1" />
        <circle cx="17" cy="15" r="1" />
      </>
    ),
    arrow: <path d="M5 12h13M13 6l6 6-6 6" />,
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14.8-4L3 10" />
        <path d="M3 5v5h5" />
        <path d="M4 13a8 8 0 0 0 14.8 4L21 14" />
        <path d="M21 19v-5h-5" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    activity: (
      <>
        <path d="M3 12h4l2-7 4 14 2-7h6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    external: (
      <>
        <path d="M14 5h5v5M19 5l-8 8" />
        <path d="M19 13v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18V7a1.5 1.5 0 0 1 1.5-1.5h5" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" className={className} {...common}>
      {paths[name] ?? paths.activity}
    </svg>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function activityLabel(type: string) {
  switch (type) {
    case "CALL":
      return "Call";
    case "SMS":
      return "SMS";
    case "EMAIL":
      return "Email";
    case "MEETING":
      return "Meeting";
    case "NOTE":
      return "Note";
    case "FOLLOW_UP":
      return "Follow-up";
    case "STATUS_CHANGE":
      return "Status change";
    default:
      return "Activity";
  }
}

function activityInitial(type: string) {
  switch (type) {
    case "CALL":
      return "C";
    case "SMS":
      return "S";
    case "EMAIL":
      return "@";
    case "MEETING":
      return "M";
    case "NOTE":
      return "N";
    case "FOLLOW_UP":
      return "F";
    case "STATUS_CHANGE":
      return "↻";
    default:
      return "•";
  }
}

function getVehicleName(vehicle: Vehicle) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter(Boolean)
    .join(" ") || "Vehicle";
}

function StatCard({
  label,
  value,
  description,
  icon,
  href,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#DCE8F5] bg-white transition-colors hover:border-[#BFD8F2] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,86,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#B9D5F5] hover:shadow-[0_8px_24px_rgba(22,119,255,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#718096]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#102A56]">
            {value}
          </p>
          <p className="mt-1 text-xs text-[#8A9AAF]">{description}</p>
        </div>

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#1677FF] transition group-hover:bg-[#1677FF] group-hover:text-white">
          <Icon name={icon} className="h-5 w-5" />
        </span>
      </div>
    </Link>
  );
}

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF] border border-[#DCE8F5] bg-white p-3 transition hover:border-[#B9D5F5] hover:bg-[#F8FBFF]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EEF6FF] text-[#1677FF]">
        <Icon name={icon} className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-[#102A56]">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-[#8795A8]">
          {description}
        </span>
      </span>

      <Icon
        name="arrow"
        className="h-4 w-4 shrink-0 text-[#A2B1C2] transition group-hover:translate-x-0.5 group-hover:text-[#1677FF]"
      />
    </Link>
  );
}

export default function Home() {
  const router = useRouter();

  const [vin, setVin] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [recentVehicles, setRecentVehicles] = useState<Vehicle[]>([]);
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [dashboardStats, setDashboardStats] =
    useState<DashboardStats | null>(null);
  const [dealershipName, setDealershipName] = useState<string | null>(null);

  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoadingStats(true);

        const [
          statsResponse,
          activitiesResponse,
          sessionResponse,
        ] = await Promise.all([
          fetch("/api/crm/dashboard", { cache: "no-store" }),
          fetch("/api/activities?limit=5", { cache: "no-store" }),
          fetch("/api/auth/session", { cache: "no-store" }),
        ]);

        // Check status and content type before parsing JSON
        if (statsResponse.ok && statsResponse.headers.get("content-type")?.includes("application/json")) {
          const statsJson = await statsResponse.json();
          if (statsJson?.success && statsJson.stats) {
            setDashboardStats(statsJson.stats);
          }
        }

        if (activitiesResponse.ok && activitiesResponse.headers.get("content-type")?.includes("application/json")) {
          const activitiesJson = await activitiesResponse.json();
          if (Array.isArray(activitiesJson?.activities)) {
            setRecentActivities(activitiesJson.activities.slice(0, 5));
          }
        }

        if (sessionResponse.ok && sessionResponse.headers.get("content-type")?.includes("application/json")) {
          const sessionJson = await sessionResponse.json();
          if (sessionJson?.profile?.dealership_name) {
            setDealershipName(sessionJson.profile.dealership_name);
          }
        }
      } catch (err) {
        console.error("Dashboard data error:", err);
      } finally {
        setLoadingStats(false);
      }
    }

    async function loadRecent() {
      try {
        setLoadingRecent(true);

        const [vehiclesResponse, reportsResponse] = await Promise.all([
          fetch("/api/vehicles", { cache: "no-store" }),
          fetch("/api/reports?limit=5", { cache: "no-store" }),
        ]);

        const vehiclesJson = await vehiclesResponse.json();
        if (vehiclesJson?.success && Array.isArray(vehiclesJson.vehicles)) {
          setRecentVehicles(vehiclesJson.vehicles.slice(0, 5));
        }

        const reportsJson = await reportsResponse.json();
        if (reportsJson?.success && Array.isArray(reportsJson.reports)) {
          setRecentReports(reportsJson.reports.slice(0, 5));
        }
      } catch (err) {
        console.error("Dashboard recent-data error:", err);
      } finally {
        setLoadingRecent(false);
      }
    }

    loadDashboard();
    loadRecent();
  }, []);

  const handleVinChange = (value: string) => {
    const normalizedValue = value.replace(/\s+/g, "").toUpperCase();

    setVin(normalizedValue.slice(0, 17));

    if (error) setError("");
    if (duplicate) setDuplicate(null);
  };

  const handleSearch = async () => {
    const normalizedVin = vin.replace(/\s+/g, "").trim().toUpperCase();

    setVin(normalizedVin);
    setError("");
    setDuplicate(null);

    if (!normalizedVin) {
      setError("Please enter a VIN.");
      return;
    }

    if (normalizedVin.length !== 17) {
      setError("Please enter a valid 17-character VIN.");
      return;
    }

    if (/[IOQ]/.test(normalizedVin)) {
      setError("Invalid VIN. VINs cannot contain the letters I, O, or Q.");
      return;
    }

    const vinPattern = /^[A-HJ-NPR-Z0-9]{17}$/;

    if (!vinPattern.test(normalizedVin)) {
      setError(
        "Invalid VIN. Please check the VIN characters and enter a valid VIN."
      );
      return;
    }

    try {
      setSearching(true);

      const response = await fetch(
        `/api/vehicles/${encodeURIComponent(normalizedVin)}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || "Vehicle could not be found or decoded.");
        return;
      }

      if (result.source === "database") {
        setDuplicate({
          vin: normalizedVin,
          checkedByName: result.checkedByName ?? null,
          updatedAt:
            result.vehicle?.updated_at ??
            result.vehicle?.created_at ??
            null,
        });
        return;
      }

      router.push(`/vehicles/${normalizedVin}`);
    } catch (err) {
      console.error("Vehicle search error:", err);
      setError("Something went wrong looking up that VIN. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleRefreshHistory = async () => {
    if (!duplicate) return;

    try {
      setRefreshing(true);

      await fetch(`/api/vehicles/${encodeURIComponent(duplicate.vin)}`, {
        method: "PATCH",
      });

      router.push(`/vehicles/${duplicate.vin}`);
    } catch (err) {
      console.error("Refresh history error:", err);
      router.push(`/vehicles/${duplicate.vin}`);
    } finally {
      setRefreshing(false);
    }
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-7 pt-0 sm:px-5 sm:pb-8 sm:pt-0 lg:px-7 lg:pt-0">
      {/* Dashboard heading */}
      <section className="mb-5 rounded-2xl border border-[#CFE2F7] bg-gradient-to-r from-[#EAF5FF] via-[#F5FAFF] to-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1677FF]">
              Shiftly Auto
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
              {greeting}
            </h1>

            <p className="mt-1 text-sm text-[#64748B]">
              {dealershipName
                ? `${dealershipName} dealership overview`
                : "Your dealership overview and vehicle intelligence"}
            </p>
          </div>
        </div>
      </section>

      {/* KPI cards */}
      {loadingStats ? (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-[126px] animate-pulse rounded-2xl border border-[#DCE8F5] bg-white bg-white"
            />
          ))}
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Customers"
            value={formatNumber(dashboardStats?.totalCustomers ?? 0)}
            description="Customer records"
            icon="users"
            href="/customers"
          />

          <StatCard
            label="Active Leads"
            value={formatNumber(dashboardStats?.activeLeads ?? 0)}
            description="Open opportunities"
            icon="leads"
            href="/leads"
          />

          <StatCard
            label="Follow-ups"
            value={formatNumber(dashboardStats?.followUpsDue ?? 0)}
            description={
              dashboardStats?.overdueFollowUps
                ? `${dashboardStats.overdueFollowUps} overdue`
                : "Currently due"
            }
            icon="calendar"
            href="/crm"
          />

          <StatCard
            label="Reports"
            value={formatNumber(dashboardStats?.reportsGenerated ?? 0)}
            description="Generated reports"
            icon="report"
            href="/reports"
          />
        </div>
      )}

      {/* VIN intelligence */}
      <section className="mb-5 overflow-hidden rounded-2xl border border-[#DCE8F5] bg-white bg-white shadow-[0_1px_2px_rgba(16,42,86,0.04)]">
        <div className="border-b border-[#E8EEF5] bg-[#F8FBFF] px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E6F2FF] text-[#1677FF]">
              <Icon name="search" className="h-5 w-5" />
            </span>

            <div>
              <h2 className="text-sm font-semibold text-[#102A56] sm:text-base">
                Vehicle Intelligence
              </h2>
              <p className="mt-0.5 text-xs text-[#718096]">
                Search a 17-character VIN to analyze a vehicle and generate a dealership report.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5"><div className="max-w-2xl"><div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Icon
                name="car"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
              />

              <input
                type="text"
                value={vin}
                onChange={(event) => handleVinChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
                placeholder="Enter 17-character VIN"
                maxLength={17}
                autoComplete="off"
                spellCheck={false}
                aria-label="Vehicle Identification Number"
                aria-invalid={Boolean(error)}
                className={`h-11 w-full rounded-xl border bg-white pl-10 pr-4 text-sm font-medium tracking-[0.08em] text-[#102A56] uppercase outline-none transition placeholder:font-normal placeholder:tracking-normal ${
                  error
                    ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    : "border-[#DCE8F5] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                }`}
              />
            </div>

            <button
              type="button"
              onClick={handleSearch}
              disabled={!vin.trim() || searching}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1677FF] px-5 text-sm font-semibold text-white transition hover:bg-[#0F67DD] disabled:cursor-not-allowed disabled:bg-[#B9C8D8] sm:min-w-[130px]"
            >
              <Icon name="search" className="h-4 w-4" />
              {searching ? "Checking..." : "Search"}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-[#94A3B8]">
              Example: 1HGCM82633A123456
            </p>

            <p
              className={`text-[11px] font-medium ${
                vin.length === 17 ? "text-emerald-600" : "text-[#94A3B8]"
              }`}
            >
              {vin.length}/17
            </p>
          </div>

          {error ? (
            <div
              className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {duplicate ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-900">
                    VIN already exists in your inventory.
                  </p>

                  <p className="mt-1 text-[11px] text-amber-700">
                    Last checked{" "}
                    {duplicate.updatedAt
                      ? new Date(duplicate.updatedAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )
                      : "recently"}
                    {duplicate.checkedByName
                      ? ` by ${duplicate.checkedByName}`
                      : ""}
                    .
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/vehicles/${duplicate.vin}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-amber-800"
                  >
                    View Report
                    <Icon name="arrow" className="h-3.5 w-3.5" />
                  </Link>

                  <button
                    type="button"
                    onClick={handleRefreshHistory}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
                  >
                    <Icon name="refresh" className="h-3.5 w-3.5" />
                    {refreshing ? "Refreshing..." : "Refresh History"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#102A56]">Quick Actions</h2>
            <p className="mt-0.5 text-xs text-[#8795A8]">
              Common dealership tasks
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <QuickAction
            href="/vehicles/new"
            icon="car"
            title="Add Vehicle"
            description="Create inventory"
          />
          <QuickAction
            href="/leads"
            icon="leads"
            title="New Lead"
            description="Manage prospects"
          />
          <QuickAction
            href="/trade-appraisals"
            icon="car"
            title="Trade-in"
            description="Start appraisal"
          />
          <QuickAction
            href="/reports"
            icon="report"
            title="Create Report"
            description="Vehicle report"
          />
          <QuickAction
            href="/vehicles"
            icon="car"
            title="Inventory"
            description="View vehicles"
          />
          <QuickAction
            href="/crm"
            icon="activity"
            title="CRM"
            description="Sales activity"
          />
        </div>
      </section>

      {/* Main dashboard content */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
        {/* Inventory */}
        <section className="min-w-0 rounded-2xl border border-[#DCE8F5] bg-white bg-white shadow-[0_1px_2px_rgba(16,42,86,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E8EEF5] px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-[#102A56]">
                Recent Inventory
              </h2>
              <p className="mt-0.5 text-xs text-[#8795A8]">
                Latest vehicles in your dealership
              </p>
            </div>

            <Link
              href="/vehicles"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1677FF] hover:text-[#0F67DD]"
            >
              View All
              <Icon name="arrow" className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="p-3 sm:p-4">
            {loadingRecent ? (
              <div className="space-y-2">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-16 animate-pulse rounded-xl bg-[#F4F7FA]"
                  />
                ))}
              </div>
            ) : recentVehicles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#CBD8E6] px-5 py-10 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F6FB] text-[#8A9AAF]">
                  <Icon name="car" className="h-5 w-5" />
                </span>

                <p className="mt-3 text-xs font-semibold text-[#52657D]">
                  No vehicles in inventory yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E8EEF5]">
                {recentVehicles.map((vehicle) => {
                  const status = vehicle.status?.toUpperCase() || "ACTIVE";

                  return (
                    <div
                      key={vehicle.id}
                      className="flex flex-col gap-3 px-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#1677FF]">
                          <Icon name="car" className="h-5 w-5" />
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#102A56]">
                            {getVehicleName(vehicle)}
                          </p>

                          <p className="mt-0.5 truncate text-[10px] font-medium tracking-wide text-[#8A9AAF]">
                            {vehicle.vin}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {vehicle.mileage !== null &&
                            vehicle.mileage !== undefined ? (
                              <span className="text-[10px] text-[#718096]">
                                {formatNumber(vehicle.mileage)} mi
                              </span>
                            ) : null}

                            {vehicle.price !== null &&
                            vehicle.price !== undefined ? (
                              <span className="text-[10px] font-semibold text-[#52657D]">
                                {formatCurrency(vehicle.price)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <span
                          className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${
                            status === "SOLD"
                              ? "bg-slate-100 text-slate-600"
                              : status === "DRAFT"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {status}
                        </span>

                        <Link
                          href={`/vehicles/${vehicle.vin}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1677FF] hover:text-[#0F67DD]"
                        >
                          View
                          <Icon name="arrow" className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Activity */}
        <section className="min-w-0 rounded-2xl border border-[#DCE8F5] bg-white bg-white shadow-[0_1px_2px_rgba(16,42,86,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E8EEF5] px-4 py-4">
            <div>
              <h2 className="text-sm font-semibold text-[#102A56]">
                Recent Activity
              </h2>
              <p className="mt-0.5 text-xs text-[#8795A8]">
                Latest CRM activity
              </p>
            </div>

            <Link
              href="/activities"
              className="text-xs font-semibold text-[#1677FF] hover:text-[#0F67DD]"
            >
              View All
            </Link>
          </div>

          <div className="p-4">
            {loadingStats ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-12 animate-pulse rounded-lg bg-[#F4F7FA]"
                  />
                ))}
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#CBD8E6] px-4 py-9 text-center">
                <Icon
                  name="activity"
                  className="mx-auto h-6 w-6 text-[#A2B1C2]"
                />
                <p className="mt-2 text-xs font-semibold text-[#52657D]">
                  No recent activity.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentActivities.map((activity) => {
                  const customerName =
                    activity.customer?.name ||
                    activity.lead?.customer_name ||
                    "Customer";

                  return (
                    <div
                      key={activity.id}
                      className="flex gap-3 rounded-xl px-2 py-2.5 transition hover:bg-[#F8FBFF]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF6FF] text-[10px] font-bold text-[#1677FF]">
                        {activityInitial(activity.activity_type)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[11px] font-semibold text-[#102A56]">
                            {activityLabel(activity.activity_type)}
                          </p>

                          <span className="shrink-0 text-[9px] text-[#9AA8B8]">
                            {formatRelativeDate(activity.activity_at)}
                          </span>
                        </div>

                        <p className="mt-0.5 truncate text-[10px] text-[#718096]">
                          {activity.description || customerName}
                        </p>

                        <p className="mt-0.5 truncate text-[9px] text-[#A0ACBA]">
                          {customerName}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Bottom row */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Follow-ups */}
        <section className="rounded-2xl border border-[#DCE8F5] bg-white bg-white shadow-[0_1px_2px_rgba(16,42,86,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E8EEF5] px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-[#102A56]">
                Follow-ups
              </h2>
              <p className="mt-0.5 text-xs text-[#8795A8]">
                CRM tasks requiring attention
              </p>
            </div>

            <Link
              href="/crm"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1677FF]"
            >
              Open CRM
              <Icon name="arrow" className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2 p-4 sm:p-5">
            <div className="rounded-xl bg-[#F7FAFD] p-3">
              <div className="flex items-center gap-1.5 text-[#64748B]">
                <Icon name="calendar" className="h-3.5 w-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-wide">
                  Due
                </span>
              </div>
              <p className="mt-2 text-xl font-bold text-[#102A56]">
                {dashboardStats?.followUpsDue ?? 0}
              </p>
            </div>

            <div className="rounded-xl bg-[#F7FAFD] p-3">
              <div className="flex items-center gap-1.5 text-[#64748B]">
                <Icon name="clock" className="h-3.5 w-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-wide">
                  Today
                </span>
              </div>
              <p className="mt-2 text-xl font-bold text-[#102A56]">
                {dashboardStats?.todayFollowUps ?? 0}
              </p>
            </div>

            <div className="rounded-xl bg-[#FFF8F5] p-3">
              <div className="flex items-center gap-1.5 text-[#C45A2A]">
                <Icon name="clock" className="h-3.5 w-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-wide">
                  Overdue
                </span>
              </div>
              <p className="mt-2 text-xl font-bold text-[#A94416]">
                {dashboardStats?.overdueFollowUps ?? 0}
              </p>
            </div>
          </div>
        </section>

        {/* Reports */}
        <section className="rounded-2xl border border-[#DCE8F5] bg-white bg-white shadow-[0_1px_2px_rgba(16,42,86,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E8EEF5] px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-[#102A56]">
                Recent Reports
              </h2>
              <p className="mt-0.5 text-xs text-[#8795A8]">
                Recently generated vehicle reports
              </p>
            </div>

            <Link
              href="/reports"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1677FF]"
            >
              View All
              <Icon name="arrow" className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="p-4 sm:p-5">
            {loadingRecent ? (
              <div className="space-y-2">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-12 animate-pulse rounded-lg bg-[#F4F7FA]"
                  />
                ))}
              </div>
            ) : recentReports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#CBD8E6] px-4 py-7 text-center">
                <Icon
                  name="report"
                  className="mx-auto h-5 w-5 text-[#A2B1C2]"
                />
                <p className="mt-2 text-xs font-semibold text-[#52657D]">
                  No reports generated yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E8EEF5]">
                {recentReports.map((report) => {
                  const vehicle = report.customer_report?.vehicle;

                  const vehicleName = vehicle
                    ? [
                        vehicle.year,
                        vehicle.make,
                        vehicle.model,
                        vehicle.trim,
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : "Vehicle report";

                  const href = report.share_token
                    ? `/reports/${report.share_token}`
                    : "/reports";

                  return (
                    <Link
                      key={report.id}
                      href={href}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF6FF] text-[#1677FF]">
                          <Icon name="report" className="h-4 w-4" />
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-[#102A56]">
                            {vehicleName || "Vehicle report"}
                          </p>
                          <p className="mt-0.5 text-[9px] text-[#8A9AAF]">
                            Created {formatRelativeDate(report.created_at)}
                          </p>
                        </div>
                      </div>

                      <Icon
                        name="external"
                        className="h-3.5 w-3.5 shrink-0 text-[#9AA8B8]"
                      />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}











