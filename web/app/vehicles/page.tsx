"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";

type Vehicle = {
  id: string;
  dealership_id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  body: string | null;
  engine: string | null;
  drivetrain: string | null;
  fuel: string | null;
  price: number | null;
  mileage: number | null;
  description: string | null;
  status: string | null;
  primary_image: string | null;
};

type VehiclesResponse = {
  success: boolean;
  vehicles?: Vehicle[];
  count?: number;
  error?: string;
};

type StatusFilter = "ALL" | "AVAILABLE" | "DRAFT" | "SOLD";
type SortOption = "NEWEST" | "PRICE_HIGH" | "PRICE_LOW" | "MILEAGE_LOW" | "MILEAGE_HIGH";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    skipped: number;
    errors: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("NEWEST");

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/vehicles", {
        cache: "no-store",
      });

      const result: VehiclesResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load vehicles.");
      }

      setVehicles(result.vehicles ?? []);
    } catch (err) {
      console.error("Vehicles page error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load vehicles."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImportFile = async (
    file: File
  ) => {
    setImportError("");
    setImportSummary(null);

    try {
      setImportLoading(true);

      const csvText = await file.text();

      const response = await fetch(
        "/api/vehicles/import",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ csv: csvText }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to import vehicles."
        );
      }

      setImportSummary(result.summary);
      await loadVehicles();
    } catch (err) {
      console.error("Import CSV error:", err);

      setImportError(
        err instanceof Error
          ? err.message
          : "Failed to import vehicles."
      );
    } finally {
      setImportLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadVehicles();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadVehicles]);

  const statusCounts = useMemo(() => {
    return {
      total: vehicles.length,
      available: vehicles.filter(
        (vehicle) => (vehicle.status || "AVAILABLE").toUpperCase() === "AVAILABLE"
      ).length,
      draft: vehicles.filter(
        (vehicle) => (vehicle.status || "").toUpperCase() === "DRAFT"
      ).length,
      sold: vehicles.filter(
        (vehicle) => (vehicle.status || "").toUpperCase() === "SOLD"
      ).length,
    };
  }, [vehicles]);

  const breakdown = useMemo(() => {
    const byMake = new Map<string, number>();

    for (const vehicle of vehicles) {
      const key = (vehicle.make || "Unknown").trim();
      byMake.set(key, (byMake.get(key) || 0) + 1);
    }

    const makeBreakdown = Array.from(byMake.entries())
      .map(([make, count]) => ({ make, count }))
      .sort((a, b) => b.count - a.count);

    const priceBuckets = [
      { label: "Under ₱500K", min: 0, max: 500000 },
      { label: "₱500K – ₱1M", min: 500000, max: 1000000 },
      { label: "₱1M – ₱2M", min: 1000000, max: 2000000 },
      { label: "₱2M and up", min: 2000000, max: Infinity },
    ].map((bucket) => ({
      ...bucket,
      count: vehicles.filter(
        (vehicle) =>
          vehicle.price !== null &&
          vehicle.price >= bucket.min &&
          vehicle.price < bucket.max
      ).length,
    }));

    const noPrice = vehicles.filter(
      (vehicle) => vehicle.price === null
    ).length;

    return { makeBreakdown, priceBuckets, noPrice };
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const result = vehicles.filter((vehicle) => {
      const status = (vehicle.status || "AVAILABLE").toUpperCase();

      const matchesStatus =
        statusFilter === "ALL" || status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        vehicle.vin,
        vehicle.make,
        vehicle.model,
        vehicle.trim,
        vehicle.year,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });

    return [...result].sort((a, b) => {
      if (sortBy === "PRICE_HIGH") {
        return (b.price ?? -1) - (a.price ?? -1);
      }

      if (sortBy === "PRICE_LOW") {
        return (a.price ?? Number.MAX_SAFE_INTEGER) -
          (b.price ?? Number.MAX_SAFE_INTEGER);
      }

      if (sortBy === "MILEAGE_LOW") {
        return (a.mileage ?? Number.MAX_SAFE_INTEGER) -
          (b.mileage ?? Number.MAX_SAFE_INTEGER);
      }

      if (sortBy === "MILEAGE_HIGH") {
        return (b.mileage ?? -1) - (a.mileage ?? -1);
      }

      return 0;
    });
  }, [vehicles, search, statusFilter, sortBy]);

  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) {
      return null;
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatMileage = (mileage: number | null) => {
    if (mileage === null || mileage === undefined) {
      return null;
    }

    return `${new Intl.NumberFormat("en-US").format(mileage)} km`;
  };

  const getStatusClasses = (status: string) => {
    if (status === "SOLD") {
      return "bg-red-100 text-red-700";
    }

    if (status === "DRAFT") {
      return "bg-gray-100 text-gray-600";
    }

    return "bg-green-100 text-green-700";
  };

  return (
    <main className="min-h-screen bg-gray-100">
      <AppHeader />

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">
              Vehicle Intelligence
            </p>

            <h1 className="mt-1 text-3xl font-bold text-gray-900">
              Inventory
            </h1>

            <p className="mt-2 max-w-2xl text-gray-600">
              Manage your dealership vehicles and quickly open Vehicle
              Intelligence for any VIN.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/vehicle-import-template.csv"
              download
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              Download Template
            </a>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImportFile(file);
                }
                e.target.value = "";
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importLoading ? "Importing..." : "Import CSV"}
            </button>

            <button
              type="button"
              onClick={loadVehicles}
              disabled={loading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh
            </button>

            <Link
              href="/vehicles/new"
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-700"
            >
              + Add Vehicle
            </Link>
          </div>
        </div>

        {(importSummary || importError) && (
          <div
            className={`mt-4 rounded-lg border p-4 text-sm ${
              importError
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {importError
              ? importError
              : `Import complete — ${importSummary?.imported} added, ${importSummary?.skipped} skipped (duplicate VIN), ${importSummary?.errors} had errors.`}
          </div>
        )}

        {/* Inventory Summary */}
        {!loading && !error && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`rounded-xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md ${
                statusFilter === "ALL"
                  ? "border-gray-900 ring-1 ring-gray-900"
                  : "border-gray-200"
              }`}
            >
              <p className="text-sm font-medium text-gray-500">
                Total Inventory
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {statusCounts.total}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("AVAILABLE")}
              className={`rounded-xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md ${
                statusFilter === "AVAILABLE"
                  ? "border-green-600 ring-1 ring-green-600"
                  : "border-gray-200"
              }`}
            >
              <p className="text-sm font-medium text-gray-500">
                Available
              </p>
              <p className="mt-2 text-3xl font-bold text-green-700">
                {statusCounts.available}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("DRAFT")}
              className={`rounded-xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md ${
                statusFilter === "DRAFT"
                  ? "border-gray-500 ring-1 ring-gray-500"
                  : "border-gray-200"
              }`}
            >
              <p className="text-sm font-medium text-gray-500">
                Draft
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-700">
                {statusCounts.draft}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("SOLD")}
              className={`rounded-xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md ${
                statusFilter === "SOLD"
                  ? "border-red-600 ring-1 ring-red-600"
                  : "border-gray-200"
              }`}
            >
              <p className="text-sm font-medium text-gray-500">
                Sold
              </p>
              <p className="mt-2 text-3xl font-bold text-red-700">
                {statusCounts.sold}
              </p>
            </button>
          </div>
        )}

        {/* Breakdown */}
        {!loading && !error && vehicles.length > 0 && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-900">
                By Make
              </p>

              <div className="mt-3 space-y-2">
                {breakdown.makeBreakdown.map((item) => (
                  <div
                    key={item.make}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-600">
                      {item.make}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-900">
                By Price Range
              </p>

              <div className="mt-3 space-y-2">
                {breakdown.priceBuckets.map((bucket) => (
                  <div
                    key={bucket.label}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-600">
                      {bucket.label}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {bucket.count}
                    </span>
                  </div>
                ))}

                {breakdown.noPrice > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      No price set
                    </span>
                    <span className="font-semibold text-gray-900">
                      {breakdown.noPrice}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search / Filters */}
        {!loading && !error && vehicles.length > 0 && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
              <div>
                <label
                  htmlFor="inventory-search"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500"
                >
                  Search Inventory
                </label>

                <input
                  id="inventory-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="VIN, make, model, trim, or year"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                />
              </div>

              <div>
                <label
                  htmlFor="status-filter"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500"
                >
                  Status
                </label>

                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                >
                  <option value="ALL">All statuses</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SOLD">Sold</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="sort-by"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500"
                >
                  Sort By
                </label>

                <select
                  id="sort-by"
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value as SortOption)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                >
                  <option value="NEWEST">Newest</option>
                  <option value="PRICE_HIGH">Price: High to Low</option>
                  <option value="PRICE_LOW">Price: Low to High</option>
                  <option value="MILEAGE_LOW">Mileage: Low to High</option>
                  <option value="MILEAGE_HIGH">Mileage: High to Low</option>
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
              <span>
                Showing{" "}
                <strong className="text-gray-900">
                  {filteredVehicles.length}
                </strong>{" "}
                of{" "}
                <strong className="text-gray-900">
                  {vehicles.length}
                </strong>{" "}
                vehicles
              </span>

              {(search || statusFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                  }}
                  className="font-semibold text-gray-900 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-gray-700">
              Loading inventory...
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Fetching the latest vehicle records.
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="mt-8 rounded-xl border border-red-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900">
              Unable to load inventory
            </h2>

            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={loadVehicles}
              className="mt-5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty Inventory */}
        {!loading && !error && vehicles.length === 0 && (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <h2 className="font-semibold text-gray-900">
              No vehicles in inventory
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Add your first vehicle to start building your dealership
              inventory.
            </p>

            <Link
              href="/vehicles/new"
              className="mt-5 inline-flex rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700"
            >
              + Add Your First Vehicle
            </Link>
          </div>
        )}

        {/* No Search Results */}
        {!loading &&
          !error &&
          vehicles.length > 0 &&
          filteredVehicles.length === 0 && (
            <div className="mt-8 rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <h2 className="font-semibold text-gray-900">
                No matching vehicles
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Try changing your search or inventory filters.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                }}
                className="mt-5 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700"
              >
                Clear Filters
              </button>
            </div>
          )}

        {/* Inventory Cards */}
        {!loading &&
          !error &&
          filteredVehicles.length > 0 && (
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredVehicles.map((vehicle) => {
                const vehicleName = [
                  vehicle.year,
                  vehicle.make,
                  vehicle.model,
                  vehicle.trim,
                ]
                  .filter(Boolean)
                  .join(" ");

                const details = [
                  vehicle.body,
                  vehicle.engine,
                  vehicle.drivetrain,
                ]
                  .filter(Boolean)
                  .join(" · ");

                const formattedPrice = formatPrice(vehicle.price);
                const formattedMileage = formatMileage(vehicle.mileage);

                const status = (
                  vehicle.status || "AVAILABLE"
                ).toUpperCase();

                return (
                  <div
                    key={vehicle.id}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {/* Image */}
                    {vehicle.primary_image ? (
                      <div className="aspect-[16/9] overflow-hidden bg-gray-100">
                        <img
                          src={vehicle.primary_image}
                          alt={vehicleName || "Vehicle"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-[16/9] items-center justify-center bg-gray-100">
                        <span className="text-sm text-gray-400">
                          No vehicle image
                        </span>
                      </div>
                    )}

                    <div className="p-5">
                      {/* Vehicle Name + Status */}
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="font-semibold leading-6 text-gray-900">
                          {vehicleName}
                        </h2>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </div>

                      {/* VIN */}
                      <p className="mt-2 break-all font-mono text-xs text-gray-500">
                        VIN: {vehicle.vin}
                      </p>

                      {/* Details */}
                      {details && (
                        <p className="mt-3 text-sm text-gray-500">
                          {details}
                        </p>
                      )}

                      {/* Price / Mileage */}
                      {(formattedPrice || formattedMileage) && (
                        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3">
                          {formattedPrice && (
                            <div>
                              <p className="text-xs text-gray-500">
                                Price
                              </p>

                              <p className="mt-1 font-semibold text-gray-900">
                                {formattedPrice}
                              </p>
                            </div>
                          )}

                          {formattedMileage && (
                            <div>
                              <p className="text-xs text-gray-500">
                                Mileage
                              </p>

                              <p className="mt-1 font-semibold text-gray-900">
                                {formattedMileage}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Description */}
                      {vehicle.description && (
                        <p className="mt-4 line-clamp-2 text-sm text-gray-600">
                          {vehicle.description}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <Link
                          href={`/vehicles/${encodeURIComponent(
                            vehicle.vin
                          )}`}
                          className="inline-flex items-center text-sm font-semibold text-gray-900 transition hover:underline"
                        >
                          Vehicle Intelligence →
                        </Link>

                        <span className="text-xs text-gray-400">
                          VIN lookup
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </main>
  );
}