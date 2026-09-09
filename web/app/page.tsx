"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
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
    <main className="min-h-screen bg-gray-100">
      <AppHeader />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Vehicle Intelligence
          </h2>
          <p className="mt-2 text-gray-600">
            Enter a VIN to analyze a vehicle and generate a dealership report.
          </p>
        </section>

        <section className="rounded-xl border bg-white p-8 shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900">
            Vehicle Lookup
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Enter a 17-character VIN.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
              className={`flex-1 rounded-lg border px-4 py-3 text-gray-900 uppercase outline-none transition ${
                error
                  ? "border-red-500 focus:border-red-600"
                  : "border-gray-300 focus:border-black"
              }`}
            />

            <button
              type="button"
              onClick={handleSearch}
              disabled={!vin.trim() || searching}
              className="rounded-lg bg-black px-7 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {searching ? "Checking..." : "Search Vehicle"}
            </button>
          </div>

          {error && (
            <div
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Duplicate VIN (Blueprint §41) */}
          {duplicate && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-sm font-semibold text-amber-900">
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
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/vehicles/${duplicate.vin}`}
                  className="rounded-lg bg-amber-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800"
                >
                  View Existing Report
                </Link>
                <button
                  type="button"
                  onClick={handleRefreshHistory}
                  disabled={refreshing}
                  className="rounded-lg border border-amber-300 px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  {refreshing ? "Refreshing..." : "Refresh History"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Example: 1HGCM82633A123456
            </p>
            <p
              className={`text-xs ${
                vin.length === 17
                  ? "font-medium text-green-600"
                  : "text-gray-400"
              }`}
            >
              {vin.length}/17
            </p>
          </div>
        </section>

        {/* Recent Vehicles */}
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">
              Recent Vehicles
            </h3>
            <Link
              href="/vehicles"
              className="text-sm font-medium text-gray-600 transition hover:text-black"
            >
              View All →
            </Link>
          </div>

          {loadingRecent && (
            <p className="text-sm text-gray-500">Loading...</p>
          )}

          {!loadingRecent && recentVehicles.length === 0 && (
            <p className="rounded-xl border bg-white p-5 text-sm text-gray-500 shadow-sm">
              No vehicles looked up yet.
            </p>
          )}

          {!loadingRecent && recentVehicles.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              {recentVehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={[v.year, v.make, v.model].filter(Boolean).join(" ")}
                  vin={v.vin}
                />
              ))}
            </div>
          )}
        </section>

        {/* Recent Reports */}
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">
              Recent Reports
            </h3>
            <Link
              href="/reports"
              className="text-sm font-medium text-gray-600 transition hover:text-black"
            >
              View All →
            </Link>
          </div>

          {loadingRecent && (
            <p className="text-sm text-gray-500">Loading...</p>
          )}

          {!loadingRecent && recentReports.length === 0 && (
            <p className="rounded-xl border bg-white p-5 text-sm text-gray-500 shadow-sm">
              No reports generated yet.
            </p>
          )}

          {!loadingRecent && recentReports.length > 0 && (
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
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
        </section>
      </div>
    </main>
  );
}

function VehicleCard({ vehicle, vin }: { vehicle: string; vin: string }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md">
      <h4 className="font-semibold text-gray-900">{vehicle || "Vehicle"}</h4>
      <p className="mt-2 break-all text-xs text-gray-500">VIN: {vin}</p>
      <div className="mt-4 flex items-center justify-end">
        <Link
          href={`/vehicles/${vin}`}
          className="text-sm font-semibold text-gray-900 hover:underline"
        >
          View →
        </Link>
      </div>
    </div>
  );
}

function ReportRow({ vehicle, date }: { vehicle: string; date: string }) {
  return (
    <div className="flex items-center justify-between border-b px-5 py-4 last:border-b-0">
      <div>
        <h4 className="font-medium text-gray-900">{vehicle || "Vehicle"}</h4>
        <p className="mt-1 text-xs text-gray-500">Created {date}</p>
      </div>
      <Link
        href="/reports"
        className="text-sm font-semibold text-gray-900 hover:underline"
      >
        View →
      </Link>
    </div>
  );
}
