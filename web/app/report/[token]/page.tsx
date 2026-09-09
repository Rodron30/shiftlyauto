"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import type { CustomerReportPayload } from "@/lib/reportTypes";

type ReportResponse = {
  success: boolean;
  report?: CustomerReportPayload;
  created_at?: string;
  error?: string;
};

function safeDate(
  value: string | null | undefined,
  locale = "en-US"
): string {
  if (!value) return "Date not provided";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not provided";
  }

  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function safeLongDate(
  value: string | null | undefined
): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function safeNumber(
  value: number | null | undefined
): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return value.toLocaleString("en-US");
}

export default function PublicReportPage() {
  const params = useParams<{ token: string }>();

  const token = useMemo(() => {
    const raw = params?.token;

    if (Array.isArray(raw)) {
      return raw[0] ?? "";
    }

    return raw ?? "";
  }, [params]);

  const [report, setReport] =
    useState<CustomerReportPayload | null>(null);

  const [createdAt, setCreatedAt] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadReport() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/reports/${encodeURIComponent(token)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const text = await response.text();

        let result: ReportResponse;

        try {
          result = JSON.parse(text);
        } catch {
          throw new Error(
            `Unable to read the report response. Server returned HTTP ${response.status}.`
          );
        }

        if (
          !response.ok ||
          !result.success ||
          !result.report
        ) {
          throw new Error(
            result.error ||
              "Report not found or the report link is no longer valid."
          );
        }

        if (cancelled) return;

        setReport(result.report);
        setCreatedAt(
          result.created_at ?? null
        );
      } catch (err) {
        if (cancelled) return;

        console.error(
          "Public report load error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load report."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadReport();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="rounded-xl border border-gray-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-sm text-gray-500">
            Loading report...
          </p>
        </div>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">
            Unable to open report
          </h1>

          <p className="mt-3 text-sm font-medium text-red-600">
            {error || "Report not found."}
          </p>

          <p className="mt-3 text-sm text-gray-500">
            Please check the link or ask your
            salesperson to create a new customer
            report.
          </p>
        </div>
      </main>
    );
  }

  /*
   * Defensive normalization.
   *
   * This prevents the public report page from
   * crashing if one of these arrays is null or
   * missing from an older report.
   */
  const theft = Array.isArray(report.theft)
    ? report.theft
    : [];

  const odometer = Array.isArray(
    report.odometer
  )
    ? report.odometer
    : [];

  const warnings = Array.isArray(
    report.warnings
  )
    ? report.warnings
    : [];

  const vehicle =
    report.vehicle ?? {
      year: null,
      make: null,
      model: null,
      trim: null,
      vin: "",
    };

  const dealership =
    report.dealership ?? {
      name: "Your Dealership",
      logo_url: null,
    };

  const historyHighlights =
    report.history_highlights ?? {
      theft_found: theft.length > 0,
      odometer_available:
        odometer.length > 0,
    };

  const vehicleTitle = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.trim,
  ]
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
    )
    .join(" ");

  const pdfUrl = token
    ? `/api/reports/${encodeURIComponent(
        token
      )}/pdf`
    : "#";

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Dealer Header */}
          <div className="border-b border-gray-100 bg-gray-50 px-6 py-5">
            <div className="flex items-center gap-3">
              {dealership.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dealership.logo_url}
                  alt={
                    dealership.name ||
                    "Dealership logo"
                  }
                  className="h-10 w-10 rounded object-contain"
                />
              ) : null}

              <div>
                <p className="font-semibold text-gray-900">
                  {dealership.name ||
                    "Your Dealership"}
                </p>

                <p className="text-xs text-gray-500">
                  Vehicle History Report
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            {/* Vehicle */}
            <h1 className="text-xl font-bold text-gray-900">
              {vehicleTitle || "Vehicle"}
            </h1>

            <p className="mt-1 font-mono text-sm text-gray-500">
              VIN: {vehicle.vin || "—"}
            </p>

            {/* History Highlights */}
            <div className="mt-6 space-y-2 rounded-lg bg-gray-50 p-4">
              <p
                className={
                  historyHighlights.theft_found
                    ? "flex items-center gap-2 text-sm text-amber-700"
                    : "flex items-center gap-2 text-sm text-green-700"
                }
              >
                <span>
                  {historyHighlights.theft_found
                    ? "⚠"
                    : "✓"}
                </span>

                <span>
                  {historyHighlights.theft_found
                    ? "Theft-related record found"
                    : "No theft-related record was found in the available data"}
                </span>
              </p>

              <p className="flex items-center gap-2 text-sm text-gray-700">
                <span>
                  {historyHighlights.odometer_available
                    ? "✓"
                    : "–"}
                </span>

                <span>
                  {historyHighlights.odometer_available
                    ? "Odometer records available"
                    : "No odometer records available"}
                </span>
              </p>
            </div>

            {/* Theft History */}
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-gray-900">
                Theft History
              </h2>

              {theft.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">
                  No theft-related record was
                  found in the available data.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {theft.map(
                    (event, index) => (
                      <li
                        key={`${event.date ?? "no-date"}-${index}`}
                        className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
                      >
                        <p className="font-medium text-amber-900">
                          {event.description ||
                            "Theft-related record"}
                        </p>

                        <p className="mt-1 text-xs text-amber-700">
                          {safeDate(event.date)}

                          {event.location
                            ? ` · ${event.location}`
                            : ""}
                        </p>

                        <p className="mt-1 text-xs text-amber-600">
                          Source:{" "}
                          {event.source ||
                            "Not provided"}
                        </p>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>

            {/* Odometer History */}
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-gray-900">
                Odometer History
              </h2>

              {odometer.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">
                  No odometer records were found
                  in the available data.
                </p>
              ) : (
                <ol className="mt-2 space-y-1.5">
                  {odometer.map(
                    (event, index) => (
                      <li
                        key={`${event.date ?? "no-date"}-${index}`}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                      >
                        <span className="text-gray-600">
                          {safeDate(event.date)}
                        </span>

                        <span className="font-medium text-gray-900">
                          {safeNumber(
                            event.odometer
                          )}{" "}
                          km
                        </span>
                      </li>
                    )
                  )}
                </ol>
              )}
            </div>

            {/* Customer Summary */}
            <div className="mt-6 rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900">
                Summary
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-700">
                {report.customer_summary ||
                  "No customer summary is available for this report."}
              </p>

              {warnings.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Notes
                  </p>

                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-700">
                    {warnings.map(
                      (warning, index) => (
                        <li
                          key={`${warning}-${index}`}
                        >
                          {warning}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Download PDF */}
            <a
              href={pdfUrl}
              className="mt-6 block w-full rounded-lg bg-black py-2.5 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Download PDF
            </a>

            {/* Footer */}
            <p className="mt-4 text-center text-xs leading-5 text-gray-400">
              This report summarizes information
              available from the data source(s) used
              by the dealership
              {report.data_source
                ? ` (${report.data_source})`
                : ""}
              . It does
              not replace an independent vehicle
              inspection or the original source
              documentation.

              {createdAt &&
                safeLongDate(createdAt) && (
                  <>
                    {" "}
                    Generated{" "}
                    {safeLongDate(createdAt)}.
                  </>
                )}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}