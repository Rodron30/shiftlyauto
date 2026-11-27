/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import VehicleImagePlaceholder from "@/components/VehicleImagePlaceholder";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BackIcon,
  CarIcon,
  CalendarIcon,
  CheckIcon,
  DollarSignIcon,
  DownloadIcon,
  EditIcon,
  FileTextIcon,
  FilterIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  SortIcon,
  ViewIcon,
  VehiclesIcon,
  MoreIcon,
} from "@/components/icons";

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
  images?: string[] | null;
};

type VehiclesResponse = {
  success: boolean;
  vehicles?: Vehicle[];
  count?: number;
  error?: string;
};

type StatusFilter = "ALL" | "AVAILABLE" | "DRAFT" | "SOLD";

type SortOption =
  "NEWEST" | "PRICE_HIGH" | "PRICE_LOW" | "MILEAGE_LOW" | "MILEAGE_HIGH";

function VehiclesContent() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") || "");


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

      setError(err instanceof Error ? err.message : "Failed to load vehicles.");
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

      const response = await fetch("/api/vehicles/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          csv: csvText,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to import vehicles.");
      }

      setImportSummary(result.summary);
      await loadVehicles();
    } catch (err) {
      console.error("Import CSV error:", err);

      setImportError(
        err instanceof Error ? err.message : "Failed to import vehicles.",
      );
    } finally {
      setImportLoading(false);
    }
  };

  const statusCounts = useMemo(() => {
    return {
      total: vehicles.length,

      available: vehicles.filter(
        (vehicle) =>
          (vehicle.status || "AVAILABLE").toUpperCase() === "AVAILABLE",
      ).length,

      draft: vehicles.filter(
        (vehicle) => (vehicle.status || "").toUpperCase() === "DRAFT",
      ).length,

      sold: vehicles.filter(
        (vehicle) => (vehicle.status || "").toUpperCase() === "SOLD",
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
      .map(([make, count]) => ({
        make,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const priceBuckets = [
      {
        label: "Under $50K",
        min: 0,
        max: 50000,
      },
      {
        label: "$50K â€“ $100K",
        min: 50000,
        max: 100000,
      },
      {
        label: "$100K â€“ $200K",
        min: 100000,
        max: 200000,
      },
      {
        label: "$200K and up",
        min: 200000,
        max: Infinity,
      },
    ].map((bucket) => ({
      ...bucket,

      count: vehicles.filter(
        (vehicle) =>
          vehicle.price !== null &&
          vehicle.price >= bucket.min &&
          vehicle.price < bucket.max,
      ).length,
    }));

    const noPrice = vehicles.filter((vehicle) => vehicle.price === null).length;

    return {
      makeBreakdown,
      priceBuckets,
      noPrice,
    };
  }, [vehicles]);

  const [requestedPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filteredVehicles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const result = vehicles.filter((vehicle) => {
      const status = (vehicle.status || "AVAILABLE").toUpperCase();

      const matchesStatus = statusFilter === "ALL" || status === statusFilter;

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
        return (
          (a.price ?? Number.MAX_SAFE_INTEGER) -
          (b.price ?? Number.MAX_SAFE_INTEGER)
        );
      }

      if (sortBy === "MILEAGE_LOW") {
        return (
          (a.mileage ?? Number.MAX_SAFE_INTEGER) -
          (b.mileage ?? Number.MAX_SAFE_INTEGER)
        );
      }

      if (sortBy === "MILEAGE_HIGH") {
        return (b.mileage ?? -1) - (a.mileage ?? -1);
      }

      return 0;
    });
  }, [vehicles, search, statusFilter, sortBy]);
  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const paginatedVehicles = filteredVehicles.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const pageWindowStart = Math.floor((currentPage - 1) / 10) * 10 + 1;
  const pageWindowEnd = Math.min(pageWindowStart + 9, totalPages);
  const pageNumbers = Array.from(
    { length: pageWindowEnd - pageWindowStart + 1 },
    (_, index) => pageWindowStart + index,
  );


  useEffect(() => {
    const handlePaginationKeys = (event: KeyboardEvent) => {
      const target = event.target;

      if (target instanceof HTMLElement && (
        target.isContentEditable ||
        target.closest("input, textarea, select, [contenteditable='true']")
      )) {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setCurrentPage((page) => Math.min(totalPages, page + 1));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrentPage((page) => Math.max(1, page - 1));
      }
    };

    window.addEventListener("keydown", handlePaginationKeys);
    return () => window.removeEventListener("keydown", handlePaginationKeys);
  }, [totalPages]);

  const renderPagination = (visibilityClass: string) => {
    if (loading || error || filteredVehicles.length === 0) return null;

    const firstItem = (currentPage - 1) * pageSize + 1;
    const lastItem = Math.min(currentPage * pageSize, filteredVehicles.length);

    return (
      <div className={`${visibilityClass} mt-4 flex-col gap-3 rounded-2xl border border-[#DCE8F5] bg-white p-3 sm:flex-row sm:items-center sm:justify-between`}>
        <p className="text-xs text-[#64748B]">
          Showing <span className="font-semibold text-[#102A56]">{firstItem}-{lastItem}</span>
          {" "}of <span className="font-semibold text-[#102A56]">{filteredVehicles.length}</span> vehicles
        </p>
        <nav aria-label="Vehicle pagination" className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-[#DCE8F5] px-3 py-2 text-xs font-semibold text-[#475569] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          {pageNumbers.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setCurrentPage(pageNumber)}
              aria-current={currentPage === pageNumber ? "page" : undefined}
              className={`min-w-9 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                currentPage === pageNumber
                  ? "border-[#1677FF] bg-[#1677FF] text-white"
                  : "border-[#DCE8F5] bg-white text-[#475569] hover:bg-[#F5F9FD]"
              }`}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg border border-[#DCE8F5] px-3 py-2 text-xs font-semibold text-[#475569] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      </div>
    );
  };
  const formatPrice = (
    price: number | null,

  ) => {
    if (price === null || price === undefined) {
      return null;
    }

    const currencyCode = "CAD";

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

  const formatMileage = (
    mileage: number | null,
  ) => {
    if (mileage === null || mileage === undefined) {
      return null;
    }

    const unit = "KM";

    return `${new Intl.NumberFormat("en-US").format(mileage)} ${unit}`;
  };

  const getStatusClasses = (status: string) => {
    if (status === "SOLD") {
      return "border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]";
    }

    if (status === "DRAFT") {
      return "border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]";
    }

    return "border border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]";
  };


  useEffect(() => {
    setTimeout(() => {
      void loadVehicles();
    }, 0);
  }, [loadVehicles]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
      {/* Header */}
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
                  <VehiclesIcon className="h-4 w-4" />
                </span>

                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">
                  Vehicle Intelligence
                </p>
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                Inventory
              </h1>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#64748B]">
                Manage your dealership vehicles and quickly open Vehicle
                Intelligence for any VIN.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/vehicle-import-template.csv"
                download
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
              >
                <DownloadIcon className="h-4 w-4" />
                Download Template
              </a>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) {
                    handleImportFile(file);
                  }

                  event.target.value = "";
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importLoading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileTextIcon className="h-4 w-4" />
                {importLoading ? "Importing..." : "Import CSV"}
              </button>

              <button
                type="button"
                onClick={loadVehicles}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshIcon className="h-4 w-4" />
                Refresh
              </button>

              <Link
                href="/vehicles/new"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8]"
              >
                <PlusIcon className="h-4 w-4" />
                Add Vehicle
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Import feedback */}
      {(importSummary || importError) && (
        <div
          className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${
            importError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
          }`}
        >
          <div className="mt-0.5 shrink-0">
            {importError ? (
              <FileTextIcon className="h-5 w-5" />
            ) : (
              <CheckIcon className="h-5 w-5" />
            )}
          </div>

          <div>
            <p className="font-semibold">
              {importError ? "Import Failed" : "Import Complete"}
            </p>
            <p className="mt-1">
              {importError
                ? importError
                : `${importSummary?.imported} added, ${importSummary?.skipped} skipped (duplicate VIN), ${importSummary?.errors} had errors.`}
            </p>
          </div>
        </div>
      )}

      {/* Inventory Summary */}
      {!loading && !error && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => { setStatusFilter("ALL"); setCurrentPage(1); }}
            className={`group rounded-2xl border p-4 text-left transition ${
              statusFilter === "ALL"
                ? "border-[#1677FF] bg-[#F5F9FD]"
                : "border-[#DCE8F5] bg-white hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  statusFilter === "ALL"
                    ? "bg-[#1677FF] text-white"
                    : "bg-[#F5F9FD] text-[#1677FF]"
                }`}
              >
                <CarIcon className="h-4 w-4" />
              </span>

              <span className="text-xl font-bold text-[#102A56]">
                {statusCounts.total}
              </span>
            </div>

            <p className="mt-3 text-xs font-semibold text-[#64748B]">
              Total Inventory
            </p>
          </button>

          <button
            type="button"
            onClick={() => { setStatusFilter("AVAILABLE"); setCurrentPage(1); }}
            className={`group rounded-2xl border p-4 text-left transition ${
              statusFilter === "AVAILABLE"
                ? "border-[#16A34A] bg-[#F0FDF4]"
                : "border-[#DCE8F5] bg-white hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  statusFilter === "AVAILABLE"
                    ? "bg-[#16A34A] text-white"
                    : "bg-[#F0FDF4] text-[#16A34A]"
                }`}
              >
                <CheckIcon className="h-4 w-4" />
              </span>

              <span className="text-xl font-bold text-[#102A56]">
                {statusCounts.available}
              </span>
            </div>

            <p className="mt-3 text-xs font-semibold text-[#64748B]">
              Available
            </p>
          </button>

          <button
            type="button"
            onClick={() => { setStatusFilter("DRAFT"); setCurrentPage(1); }}
            className={`group rounded-2xl border p-4 text-left transition ${
              statusFilter === "DRAFT"
                ? "border-[#64748B] bg-[#F5F9FD]"
                : "border-[#DCE8F5] bg-white hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  statusFilter === "DRAFT"
                    ? "bg-[#64748B] text-white"
                    : "bg-[#F5F9FD] text-[#64748B]"
                }`}
              >
                <FileTextIcon className="h-4 w-4" />
              </span>

              <span className="text-xl font-bold text-[#102A56]">
                {statusCounts.draft}
              </span>
            </div>

            <p className="mt-3 text-xs font-semibold text-[#64748B]">Draft</p>
          </button>

          <button
            type="button"
            onClick={() => { setStatusFilter("SOLD"); setCurrentPage(1); }}
            className={`group rounded-2xl border p-4 text-left transition ${
              statusFilter === "SOLD"
                ? "border-[#475569] bg-[#F5F9FD]"
                : "border-[#DCE8F5] bg-white hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  statusFilter === "SOLD"
                    ? "bg-[#475569] text-white"
                    : "bg-[#F5F9FD] text-[#475569]"
                }`}
              >
                <DollarSignIcon className="h-4 w-4" />
              </span>

              <span className="text-xl font-bold text-[#102A56]">
                {statusCounts.sold}
              </span>
            </div>

            <p className="mt-3 text-xs font-semibold text-[#64748B]">Sold</p>
          </button>
        </div>
      )}

      {/* Breakdown */}
      {!loading && !error && vehicles.length > 0 && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F9FD] text-[#1677FF]">
                <CarIcon className="h-4 w-4" />
              </span>

              <div>
                <p className="text-sm font-semibold text-[#102A56]">By Make</p>
                <p className="text-xs text-[#64748B]">Inventory distribution</p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-[#EDF2F7]">
              {breakdown.makeBreakdown.map((item) => (
                <div
                  key={item.make}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2 text-[#475569]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1677FF]" />
                    {item.make}
                  </span>

                  <span className="font-semibold text-[#102A56]">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F9FD] text-[#1677FF]">
                <DollarSignIcon className="h-4 w-4" />
              </span>

              <div>
                <p className="text-sm font-semibold text-[#102A56]">
                  By Price Range
                </p>
                <p className="text-xs text-[#64748B]">
                  Vehicle value distribution
                </p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-[#EDF2F7]">
              {breakdown.priceBuckets.map((bucket) => (
                <div
                  key={bucket.label}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2 text-[#475569]">
                    <DollarSignIcon className="h-3.5 w-3.5 text-[#64748B]" />
                    {bucket.label}
                  </span>

                  <span className="font-semibold text-[#102A56]">
                    {bucket.count}
                  </span>
                </div>
              ))}

              {breakdown.noPrice > 0 && (
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2 text-[#475569]">
                    <DollarSignIcon className="h-3.5 w-3.5 text-[#64748B]" />
                    No price set
                  </span>

                  <span className="font-semibold text-[#102A56]">
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
        <section className="mt-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F9FD] text-[#1677FF]">
              <FilterIcon className="h-4 w-4" />
            </span>

            <div>
              <p className="text-sm font-semibold text-[#102A56]">
                Search & Filters
              </p>
              <p className="text-xs text-[#64748B]">
                Find and organize inventory
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_190px_190px]">
            <div>
              <label
                htmlFor="inventory-search"
                className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#64748B]"
              >
                <SearchIcon className="h-3.5 w-3.5" />
                Search Inventory
              </label>

              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />

                <input
                  id="inventory-search"
                  type="search"
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }}
                  placeholder="VIN, make, model, trim, or year"
                  className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white py-2.5 pl-10 pr-4 text-sm text-[#102A56] outline-none transition placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="status-filter"
                className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#64748B]"
              >
                <FilterIcon className="h-3.5 w-3.5" />
                Status
              </label>

              <select
                id="status-filter"
                value={statusFilter}
                onChange={(event) => { setStatusFilter(event.target.value as StatusFilter); setCurrentPage(1); }}
                className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3 py-2.5 text-sm text-[#102A56] outline-none focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
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
                className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#64748B]"
              >
                <SortIcon className="h-3.5 w-3.5" />
                Sort By
              </label>

              <select
                id="sort-by"
                value={sortBy}
                onChange={(event) => { setSortBy(event.target.value as SortOption); setCurrentPage(1); }}
                className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3 py-2.5 text-sm text-[#102A56] outline-none focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
              >
                <option value="NEWEST">Newest</option>
                <option value="PRICE_HIGH">Price: High to Low</option>
                <option value="PRICE_LOW">Price: Low to High</option>
                <option value="MILEAGE_LOW">Mileage: Low to High</option>
                <option value="MILEAGE_HIGH">Mileage: High to Low</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-[#EDF2F7] pt-3 text-xs text-[#64748B]">
            <CarIcon className="h-3.5 w-3.5" />

            <span>
              Showing{" "}
              <span className="font-semibold text-[#475569]">
                {filteredVehicles.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-[#475569]">
                {vehicles.length}
              </span>{" "}
              vehicles
            </span>
          </div>
        </section>
      )}

      {/* Vehicle List */}
      {loading ? (
        <div className="mt-5 flex items-center justify-center rounded-2xl border border-[#DCE8F5] bg-white p-10">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
            <RefreshIcon className="h-5 w-5 animate-spin" />
          </span>
          <p className="ml-3 text-sm font-medium text-[#64748B]">
            Loading vehicles...
          </p>
        </div>
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-white p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600">
            <FileTextIcon className="h-5 w-5" />
          </span>

          <h3 className="mt-4 text-base font-semibold text-[#102A56]">
            Unable to load vehicles
          </h3>

          <p className="mt-1 text-sm text-red-700">{error}</p>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-[#DCE8F5] bg-white p-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
            <VehiclesIcon className="h-5 w-5" />
          </span>

          <h3 className="mt-4 text-base font-semibold text-[#102A56]">
            No vehicles found
          </h3>

          <p className="mt-1 text-sm text-[#64748B]">
            Add a vehicle or import your inventory CSV.
          </p>
        </div>
      ) : (
        <div className="mt-5 hidden lg:block overflow-x-auto rounded-2xl border border-[#DCE8F5] bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[#F5F9FD]">
              <tr className="border-b border-[#DCE8F5]">
                <th className="px-4 py-3 text-left">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#64748B]">
                    <CarIcon className="h-4 w-4" />
                    VIN
                  </span>
                </th>

                <th className="px-4 py-3 text-left">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#64748B]">
                    <CalendarIcon className="h-4 w-4" />
                    Year
                  </span>
                </th>

                <th className="px-4 py-3 text-left">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#64748B]">
                    <VehiclesIcon className="h-4 w-4" />
                    Make
                  </span>
                </th>

                <th className="px-4 py-3 text-left">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#64748B]">
                    <CarIcon className="h-4 w-4" />
                    Model
                  </span>
                </th>

                <th className="px-4 py-3 text-left">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#64748B]">
                    <DollarSignIcon className="h-4 w-4" />
                    Price
                  </span>
                </th>

                <th className="px-4 py-3 text-left">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#64748B]">
                    <CarIcon className="h-4 w-4" />
                    Mileage
                  </span>
                </th>

                <th className="px-4 py-3 text-left">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#64748B]">
                    <CheckIcon className="h-4 w-4" />
                    Status
                  </span>
                </th>

                <th className="px-4 py-3 text-right">
                  <span className="inline-flex items-center justify-end gap-1.5 font-semibold text-[#64748B]">
                    <MoreIcon className="h-4 w-4" />
                    Actions
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedVehicles.map((vehicle) => {
                const status = (vehicle.status || "AVAILABLE").toUpperCase();

                return (
                  <tr
                    key={vehicle.id}
                    className="border-b border-[#EDF2F7] transition-colors last:border-0 hover:bg-[#F8FBFF]"
                  >
                    <td className="px-4 py-3.5">
                        <Link
                          href={`/vehicles/${encodeURIComponent(vehicle.vin)}`}
                          className="inline-flex items-center gap-3 group"
                        >
                          <span className="flex h-12 w-16 shrink-0 overflow-hidden rounded-xl border border-[#DCE8F5] bg-[#F8FBFF]">
                            {vehicle.primary_image ? (
                              <img
                                src={vehicle.primary_image}
                                alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <VehicleImagePlaceholder />
                            )}
                          </span>
                          <span className="font-semibold text-[#102A56] group-hover:text-[#1677FF] group-hover:underline">
                            {vehicle.vin || vehicle.id}
                          </span>
                        </Link>
                    </td>

                    <td className="px-4 py-3.5 text-[#475569]">
                      {vehicle.year || "-"}
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-[#102A56]">
                      {vehicle.make || "-"}
                    </td>

                    <td className="px-4 py-3.5 text-[#475569]">
                      {vehicle.model || "-"}
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-[#102A56]">
                      {formatPrice(vehicle.price) || "-"}
                    </td>

                    <td className="px-4 py-3.5 text-[#475569]">
                      {formatMileage(vehicle.mileage) ||
                        "-"}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                          status,
                        )}`}
                      >
                        {status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/vehicles/${encodeURIComponent(vehicle.vin)}/edit`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE8F5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1677FF] transition hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                      >
                        <EditIcon className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {renderPagination("hidden lg:flex")}

      {/* Mobile Vehicle Cards */}
      {!loading && !error && vehicles.length > 0 && (
        <div className="mt-5 space-y-3 lg:hidden">
          {paginatedVehicles.map((vehicle) => {
            const status = (vehicle.status || "AVAILABLE").toUpperCase();

            return (
              <div
                key={vehicle.id}
                className="rounded-2xl border border-[#DCE8F5] bg-white p-4 transition-colors hover:border-[#BFD8F2]"
              >
                <div className="flex gap-3">
                  <Link
                    href={`/vehicles/${encodeURIComponent(vehicle.vin)}`}
                    className="shrink-0"
                  >
                    <span className="flex h-20 w-24 overflow-hidden rounded-xl border border-[#DCE8F5] bg-[#F8FBFF]">
                      {vehicle.primary_image ? (
                        <img
                          src={vehicle.primary_image}
                          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <VehicleImagePlaceholder />
                      )}
                    </span>
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/vehicles/${encodeURIComponent(vehicle.vin)}`}
                      className="group"
                    >
                      <p className="truncate text-sm font-semibold text-[#102A56] group-hover:text-[#1677FF]">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                        {vehicle.trim && ` ${vehicle.trim}`}
                      </p>
                    </Link>

                    <p className="mt-1 text-xs text-[#64748B]">
                      VIN: {vehicle.vin || vehicle.id}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusClasses(
                          status,
                        )}`}
                      >
                        {status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#EDF2F7] pt-3">
                  <div>
                    <p className="text-[10px] text-[#64748B]">Price</p>
                    <p className="mt-0.5 text-sm font-semibold text-[#102A56]">
                      {formatPrice(vehicle.price) || "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-[#64748B]">Mileage</p>
                    <p className="mt-0.5 text-sm font-semibold text-[#102A56]">
                      {formatMileage(vehicle.mileage) ||
                        "-"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/vehicles/${encodeURIComponent(vehicle.vin)}`}
                    className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#DCE8F5] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                  >
                    <ViewIcon className="h-3.5 w-3.5" />
                    View
                  </Link>

                  <Link
                    href={`/vehicles/${encodeURIComponent(vehicle.vin)}/edit`}
                    className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#1677FF] bg-[#1677FF] px-3 text-xs font-semibold text-white transition hover:border-[#0F67E8] hover:bg-[#0F67E8]"
                  >
                    <EditIcon className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {renderPagination("flex lg:hidden")}

    </div>
  );
}

export default function VehiclesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accessDenied, setAccessDenied] = useState(false);

  const [roleChecked, setRoleChecked] = useState(false);

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

  useEffect(() => {
    if (accessDenied) {
      router.push("/leads");
    }
  }, [accessDenied, router]);

  if (!roleChecked) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-2 text-sm text-[#8B9DB3]">
          <RefreshIcon className="h-4 w-4" />
          Loading...
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <FileTextIcon className="mt-0.5 h-5 w-5 text-amber-600" />

            <div>
              <h1 className="mb-2 text-lg font-semibold text-gray-900">
                Access Denied
              </h1>

              <p className="text-sm text-gray-700">
                Customers do not have access to vehicle inventory management.
                Redirecting to Leads...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <VehiclesContent key={searchParams.get("q") || ""} />;
}




