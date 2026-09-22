"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerReportPayload } from "@/lib/reportTypes";

type Vehicle = {
  id: string;
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
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

export default function Home() {
  const router = useRouter();
  const [vin, setVin] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [recentVehicles, setRecentVehicles] = useState<Vehicle[]>([]);
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    async function loadRecent() {
      try {
        setLoadingRecent(true);
        const [vehiclesRes, reportsRes] = await Promise.all([
          fetch("/api/vehicles", { cache: "no-store" }),
          fetch("/api/reports?limit=5", { cache: "no-store" }),
        ]);

        const vehiclesJson = await vehiclesRes.json();
        if (vehiclesJson.success) {
          setRecentVehicles((vehiclesJson.vehicles ?? []).slice(0, 3));
        }

        const reportsJson = await reportsRes.json();
        if (reportsJson.success) {
          setRecentReports((reportsJson.reports ?? []).slice(0, 3));
        }
      } catch (err) {
        console.error("Dashboard recent-data error:", err);
      } finally {
        setLoadingRecent(false);
      }
    }

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

    // Blueprint §41: check whether this VIN is already on file before
    // navigating, so a salesperson isn't surprised by an existing record.
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
          updatedAt: result.vehicle?.updated_at ?? result.vehicle?.created_at ?? null,
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

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Vehicle Intelligence
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Enter a VIN to analyze a vehicle and generate a dealership report.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">
          Vehicle Lookup
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Enter a 17-character VIN.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={vin}
            onChange={(e) => handleVinChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Enter 17-character VIN"
            maxLength={17}
            autoComplete="off"
            spellCheck={false}
            aria-label="Vehicle Identification Number"
            aria-invalid={Boolean(error)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm text-neutral-900 uppercase outline-none transition ${
              error
                ? "border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-400"
                : "border-neutral-300 focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
            }`}
          />

          <button
            type="button"
            onClick={handleSearch}
            disabled={!vin.trim() || searching}
            className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {searching ? "Checking..." : "Search Vehicle"}
          </button>
        </div>

        {error && (
          <div
            className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Duplicate VIN (Blueprint §41) */}
        {duplicate && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
            <p className="text-xs font-semibold text-amber-900">
              VIN already exists.
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Last checked{" "}
              {duplicate.updatedAt
                ? new Date(duplicate.updatedAt).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "recently"}
              {duplicate.checkedByName && ` by ${duplicate.checkedByName}`}.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={`/vehicles/${duplicate.vin}`}
                className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
              >
                View Existing Report
              </Link>
              <button
                type="button"
                onClick={handleRefreshHistory}
                disabled={refreshing}
                className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                {refreshing ? "Refreshing..." : "Refresh History"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            Example: 1HGCM82633A123456
          </p>
          <p
            className={`text-xs ${
              vin.length === 17
                ? "font-medium text-green-600"
                : "text-neutral-400"
            }`}
          >
            {vin.length}/17
          </p>
        </div>
      </div>

      {/* Recent Vehicles */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">
            Recent Vehicles
          </h2>
          <Link
            href="/vehicles"
            className="text-xs font-medium text-neutral-600 transition hover:text-neutral-900"
          >
            View All →
          </Link>
        </div>

        {loadingRecent && (
          <p className="text-xs text-neutral-500">Loading...</p>
        )}

        {!loadingRecent && recentVehicles.length === 0 && (
          <p className="rounded-lg border border-neutral-200 bg-white p-4 text-xs text-neutral-500 shadow-sm">
            No vehicles looked up yet.
          </p>
        )}

        {!loadingRecent && recentVehicles.length > 0 && (
          <div className="grid gap-3 md:grid-cols-3">
            {recentVehicles.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={[v.year, v.make, v.model].filter(Boolean).join(" ")}
                vin={v.vin}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Reports */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">
            Recent Reports
          </h2>
          <Link
            href="/reports"
            className="text-xs font-medium text-neutral-600 transition hover:text-neutral-900"
          >
            View All →
          </Link>
        </div>

        {loadingRecent && (
          <p className="text-xs text-neutral-500">Loading...</p>
        )}

        {!loadingRecent && recentReports.length === 0 && (
          <p className="rounded-lg border border-neutral-200 bg-white p-4 text-xs text-neutral-500 shadow-sm">
            No reports generated yet.
          </p>
        )}

        {!loadingRecent && recentReports.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            {recentReports.map((r) => {
              const v = r.customer_report.vehicle;
              return (
                <ReportRow
                  key={r.id}
                  vehicle={[v.year, v.make, v.model, v.trim]
                    .filter(Boolean)
                    .join(" ")}
                  date={new Date(r.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function VehicleCard({ vehicle, vin }: { vehicle: string; vin: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition hover:shadow-md">
      <h4 className="text-sm font-semibold text-neutral-900">{vehicle || "Vehicle"}</h4>
      <p className="mt-1 break-all text-xs text-neutral-500">VIN: {vin}</p>
      <div className="mt-2 flex items-center justify-end">
        <Link
          href={`/vehicles/${vin}`}
          className="text-xs font-semibold text-neutral-900 hover:underline"
        >
          View →
        </Link>
      </div>
    </div>
  );
}

function ReportRow({ vehicle, date }: { vehicle: string; date: string }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 last:border-b-0">
      <div>
        <h4 className="text-sm font-medium text-neutral-900">{vehicle || "Vehicle"}</h4>
        <p className="mt-1 text-xs text-neutral-500">Created {date}</p>
      </div>
      <Link
        href="/reports"
        className="text-xs font-semibold text-neutral-900 hover:underline"
      >
        View →
      </Link>
    </div>
  );
}

