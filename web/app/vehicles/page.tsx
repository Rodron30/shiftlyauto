"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import VehicleImagePlaceholder from "@/components/VehicleImagePlaceholder";

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
  currency: string | null;
  mileage: number | null;
  mileage_unit: string | null;
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

// Inner component with all inventory-specific hooks
function VehiclesContent() {
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

  const handleImportFile = async (file: File) => {
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
      { label: "Under $50K", min: 0, max: 50000 },
      { label: "$50K – $100K", min: 50000, max: 100000 },
      { label: "$100K – $200K", min: 100000, max: 200000 },
      { label: "$200K and up", min: 200000, max: Infinity },
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

  const formatPrice = (price: number | null, currency: string | null = null) => {
    if (price === null || price === undefined) {
      return null;
    }

    const currencyCode = currency || "USD";
    
    const localeMap: Record<string, string> = {
      USD: "en-US",
      PHP: "en-PH",
      EUR: "de-DE",
      GBP: "en-GB",
      CAD: "en-CA",
      AUD: "en-AU",
      JPY: "ja-JP",
      CNY: "zh-CN",
      SGD: "en-SG",
      HKD: "en-HK",
      MYR: "en-MY",
      THB: "th-TH",
      IDR: "id-ID",
      VND: "vi-VN",
    };

    const locale = localeMap[currencyCode] || "en-US";

    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatMileage = (mileage: number | null, mileageUnit: string | null = null) => {
    if (mileage === null || mileage === undefined) {
      return null;
    }

    const unit = mileageUnit || "km";
    return `${new Intl.NumberFormat("en-US").format(mileage)} ${unit}`;
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

  // Load vehicles on mount
  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium text-neutral-500">
            Vehicle Intelligence
          </p>

          <h1 className="mt-1 text-xl font-semibold text-neutral-900">
            Inventory
          </h1>

          <p className="mt-1 text-xs text-neutral-600">
            Manage your dealership vehicles and quickly open Vehicle
            Intelligence for any VIN.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/vehicle-import-template.csv"
            download
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
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
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importLoading ? "Importing..." : "Import CSV"}
          </button>

          <button
            type="button"
            onClick={loadVehicles}
            disabled={loading}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>

          <Link
            href="/vehicles/new"
            className="inline-flex items-center justify-center rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-800"
          >
            + Add Vehicle
          </Link>
        </div>
      </div>

        {(importSummary || importError) && (
          <div
            className={`mt-3 rounded-md border p-3 text-xs ${
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
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`rounded-lg border bg-white p-3 text-left shadow-sm transition hover:shadow-md ${
                statusFilter === "ALL"
                  ? "border-neutral-900 ring-1 ring-neutral-900"
                  : "border-neutral-200"
              }`}
            >
              <p className="text-xs font-medium text-neutral-500">
                Total Inventory
              </p>
              <p className="mt-1 text-xl font-bold text-neutral-900">
                {statusCounts.total}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("AVAILABLE")}
              className={`rounded-lg border bg-white p-3 text-left shadow-sm transition hover:shadow-md ${
                statusFilter === "AVAILABLE"
                  ? "border-green-600 ring-1 ring-green-600"
                  : "border-neutral-200"
              }`}
            >
              <p className="text-xs font-medium text-neutral-500">
                Available
              </p>
              <p className="mt-1 text-xl font-bold text-green-700">
                {statusCounts.available}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("DRAFT")}
              className={`rounded-lg border bg-white p-3 text-left shadow-sm transition hover:shadow-md ${
                statusFilter === "DRAFT"
                  ? "border-neutral-500 ring-1 ring-neutral-500"
                  : "border-neutral-200"
              }`}
            >
              <p className="text-xs font-medium text-neutral-500">
                Draft
              </p>
              <p className="mt-1 text-xl font-bold text-neutral-700">
                {statusCounts.draft}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("SOLD")}
              className={`rounded-lg border bg-white p-3 text-left shadow-sm transition hover:shadow-md ${
                statusFilter === "SOLD"
                  ? "border-red-600 ring-1 ring-red-600"
                  : "border-neutral-200"
              }`}
            >
              <p className="text-xs font-medium text-neutral-500">
                Sold
              </p>
              <p className="mt-1 text-xl font-bold text-red-700">
                {statusCounts.sold}
              </p>
            </button>
          </div>
        )}

        {/* Breakdown */}
        {!loading && !error && vehicles.length > 0 && (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-neutral-900">
                By Make
              </p>

              <div className="mt-2 space-y-1.5">
                {breakdown.makeBreakdown.map((item) => (
                  <div
                    key={item.make}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-neutral-600">
                      {item.make}
                    </span>
                    <span className="font-semibold text-neutral-900">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-neutral-900">
                By Price Range
              </p>

              <div className="mt-2 space-y-1.5">
                {breakdown.priceBuckets.map((bucket) => (
                  <div
                    key={bucket.label}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-neutral-600">
                      {bucket.label}
                    </span>
                    <span className="font-semibold text-neutral-900">
                      {bucket.count}
                    </span>
                  </div>
                ))}

                {breakdown.noPrice > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-600">
                      No price set
                    </span>
                    <span className="font-semibold text-neutral-900">
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
          <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[1fr_200px_200px]">
              <div>
                <label
                  htmlFor="inventory-search"
                  className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
                >
                  Search Inventory
                </label>

                <input
                  id="inventory-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="VIN, make, model, trim, or year"
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                />
              </div>

              <div>
                <label
                  htmlFor="status-filter"
                  className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
                >
                  Status
                </label>

                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
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
                  className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
                >
                  Sort By
                </label>

                <select
                  id="sort-by"
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value as SortOption)
                  }
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                >
                  <option value="NEWEST">Newest</option>
                  <option value="PRICE_HIGH">Price: High to Low</option>
                  <option value="PRICE_LOW">Price: Low to High</option>
                  <option value="MILEAGE_LOW">Mileage: Low to High</option>
                  <option value="MILEAGE_HIGH">Mileage: High to Low</option>
                </select>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
              <span>
                Showing{" "}
                {filteredVehicles.length}{" "}
                of{" "}
                {vehicles.length}{" "}
                vehicles
              </span>
            </div>
          </div>
        )}

        {/* Vehicle List */}
        {loading ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-500">Loading vehicles...</p>
          </div>
        ) : error ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-500">No vehicles found.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-2 pr-4 font-semibold text-neutral-900">
                    VIN
                  </th>
                  <th className="text-left py-2 pr-4 font-semibold text-neutral-900">
                    Year
                  </th>
                  <th className="text-left py-2 pr-4 font-semibold text-neutral-900">
                    Make
                  </th>
                  <th className="text-left py-2 pr-4 font-semibold text-neutral-900">
                    Model
                  </th>
                  <th className="text-left py-2 pr-4 font-semibold text-neutral-900">
                    Price
                  </th>
                  <th className="text-left py-2 pr-4 font-semibold text-neutral-900">
                    Mileage
                  </th>
                  <th className="text-left py-2 pr-4 font-semibold text-neutral-900">
                    Status
                  </th>
                  <th className="text-right py-2 font-semibold text-neutral-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle) => (
                  <tr
                    key={vehicle.id}
                    className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
                  >
                    <td className="py-2 pr-4 font-medium text-neutral-900">
                      <Link
                        href={`/vehicles/${encodeURIComponent(vehicle.vin)}`}
                        className="hover:underline"
                      >
                        {vehicle.vin || vehicle.id}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-neutral-600">
                      {vehicle.year || "-"}
                    </td>
                    <td className="py-2 pr-4 text-neutral-600">
                      {vehicle.make || "-"}
                    </td>
                    <td className="py-2 pr-4 text-neutral-600">
                      {vehicle.model || "-"}
                    </td>
                    <td className="py-2 pr-4 text-neutral-600">
                      {formatPrice(vehicle.price, vehicle.currency)}
                    </td>
                    <td className="py-2 pr-4 text-neutral-600">
                      {formatMileage(vehicle.mileage, vehicle.mileage_unit)}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusClasses(
                          vehicle.status || "AVAILABLE"
                        )}`}
                      >
                        {vehicle.status || "AVAILABLE"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <Link
                        href={`/vehicles/${encodeURIComponent(vehicle.vin)}/edit`}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

// Outer component with auth logic only
export default function VehiclesPage() {
  const router = useRouter();
  const [accessDenied, setAccessDenied] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);

  // Check user role on mount
  useEffect(() => {
    async function checkAccess() {
      try {
        const response = await fetch("/api/auth/session");
        const result = await response.json();
        
        if (result.profile?.role === "customer") {
          setAccessDenied(true);
        }
      } catch (err) {
        console.error("Failed to check user role:", err);
      } finally {
        setRoleChecked(true);
      }
    }
    
    checkAccess();
  }, []);

  // Redirect customers to appropriate page
  useEffect(() => {
    if (accessDenied) {
      router.push("/leads");
    }
  }, [accessDenied, router]);

  // Show loading while checking role
  if (!roleChecked) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <p className="text-sm text-neutral-500">Loading...</p>
      </div>
    );
  }

  // Show access denied for customers
  if (accessDenied) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h1 className="text-lg font-semibold text-amber-900 mb-2">Access Denied</h1>
          <p className="text-amber-700 mb-4">
            Customers do not have access to vehicle inventory management. Redirecting to Leads...
          </p>
        </div>
      </div>
    );
  }

  // Show inventory content for authorized users
  return <VehiclesContent />;
}
