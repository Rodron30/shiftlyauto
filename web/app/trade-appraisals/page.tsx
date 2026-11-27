"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BackIcon,
  TradeInsIcon,
  PlusIcon,
  SaveIcon,
  XIcon,
  RefreshIcon,
  CarIcon,
  DollarSignIcon,
} from "@/components/icons";

type Appraisal = {
  id: string;
  vin: string | null;
  year: number | null;
  make: string;
  model: string;
  trim: string | null;
  mileage: number | null;
  condition: string;
  market_value: number;
  deduction_percent: number;
  appraised_value: number;
  history_score: number | null;
  wholesale_estimate: number | null;
  retail_estimate: number | null;
  notes: string | null;
  created_at: string;
};

type Condition = "EXCELLENT" | "GOOD" | "FAIR" | "POOR";

const DEFAULT_DEDUCTION: Record<Condition, number> = {
  EXCELLENT: 10,
  GOOD: 15,
  FAIR: 20,
  POOR: 30,
};

function formatNumberInput(value: string) {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");

  if (!cleaned) return "";

  const firstDotIndex = cleaned.indexOf(".");

  let integerPart =
    firstDotIndex === -1 ? cleaned : cleaned.slice(0, firstDotIndex);

  const decimalPart =
    firstDotIndex === -1
      ? ""
      : cleaned
          .slice(firstDotIndex + 1)
          .replace(/\./g, "")
          .slice(0, 2);

  if (!integerPart) integerPart = "0";

  integerPart = integerPart.replace(/^0+(?=\d)/, "");

  const formattedInteger = Number(integerPart).toLocaleString("en-US");

  return firstDotIndex !== -1
    ? `${formattedInteger}.${decimalPart}`
    : formattedInteger;
}

function formatCurrency(value: number | null) {
  if (value === null || !Number.isFinite(Number(value))) {
    return "N/A";
  }

  return `$${Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function conditionClasses(condition: string) {
  switch (condition) {
    case "EXCELLENT":
      return "border border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]";
    case "GOOD":
      return "border border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]";
    case "FAIR":
      return "border border-[#FED7AA] bg-[#FFFBEB] text-[#92400E]";
    case "POOR":
      return "border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]";
    default:
      return "border border-[#CFE2F5] bg-[#F5F9FD] text-[#475569]";
  }
}

export default function TradeAppraisalsPage() {
  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [mileage, setMileage] = useState("");
  const [condition, setCondition] = useState<Condition>("GOOD");
  const [marketValue, setMarketValue] = useState("");
  const [deductionPercent, setDeductionPercent] = useState(
    String(DEFAULT_DEDUCTION.GOOD),
  );
  const [deductionTouched, setDeductionTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadAppraisals = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/trade-appraisals", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load trade appraisals.");
      }

      setAppraisals(result.appraisals ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load trade appraisals.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      void loadAppraisals();
    }, 0);
  }, []);
  const handleConditionChange = (value: Condition) => {
    setCondition(value);

    if (!deductionTouched) {
      setDeductionPercent(String(DEFAULT_DEDUCTION[value]));
    }
  };

  const previewAppraisedValue = useMemo(() => {
    const mv = Number(marketValue.replace(/,/g, ""));
    const dp = Number(deductionPercent);

    if (!Number.isFinite(mv) || mv <= 0 || !Number.isFinite(dp)) {
      return null;
    }

    return Math.round(mv * (1 - dp / 100) * 100) / 100;
  }, [marketValue, deductionPercent]);

  const resetForm = () => {
    setVin("");
    setYear("");
    setMake("");
    setModel("");
    setTrim("");
    setMileage("");
    setCondition("GOOD");
    setMarketValue("");
    setDeductionPercent(String(DEFAULT_DEDUCTION.GOOD));
    setDeductionTouched(false);
    setNotes("");
    setFormError("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!make.trim() || !model.trim()) {
      setFormError("Make and model are required.");
      return;
    }

    if (
      marketValue &&
      !Number.isFinite(Number(marketValue.replace(/,/g, "")))
    ) {
      setFormError("Enter a valid market value.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/trade-appraisals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin: vin || undefined,
          year: year || undefined,
          make,
          model,
          trim: trim || undefined,
          mileage: mileage || undefined,
          condition,
          marketValue: marketValue || undefined,
          deductionPercent,
          notes: notes || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save trade appraisal.");
      }

      resetForm();
      setShowForm(false);
      await loadAppraisals();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save trade appraisal.",
      );
    } finally {
      setSaving(false);
    }
  };

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
                  <TradeInsIcon className="h-4 w-4" />
                </span>

                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">
                  Vehicle Intelligence
                </p>
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                Trade-In Appraisals
              </h1>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#64748B]">
                Estimate a customer trade-in using market value, vehicle
                history, condition, and valuation estimates.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] sm:w-auto"
            >
              <PlusIcon className="h-4 w-4" />
              New Appraisal
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
              <PlusIcon className="h-4 w-4" />
            </span>

            <div>
              <h2 className="text-base font-bold text-[#102A56]">
                New Trade-In Appraisal
              </h2>

              <p className="text-xs text-[#64748B]">
                Internal appraisal estimate. Final trade value should be
                reviewed by dealership management.
              </p>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] px-4 py-3 text-xs text-[#64748B]">
            This is an internal estimate. The final trade value should be
            reviewed by dealership management before being presented to
            customers.
          </div>

          <div className="mb-4">
            <h3 className="mb-3 text-sm font-bold text-[#102A56]">
              Vehicle Information
            </h3>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  VIN
                  <span className="font-normal text-[#64748B]">
                    {" "}
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={vin}
                  onChange={(e) =>
                    setVin(e.target.value.toUpperCase().replace(/\s+/g, ""))
                  }
                  maxLength={17}
                  placeholder="17-character VIN"
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  Year
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={year}
                  onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                  placeholder="2020"
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  Mileage (km)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={mileage}
                  onChange={(e) =>
                    setMileage(formatNumberInput(e.target.value))
                  }
                  placeholder="60,000"
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  Make
                  <span className="text-red-600"> *</span>
                </label>
                <input
                  type="text"
                  required
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="Toyota"
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  Model
                  <span className="text-red-600"> *</span>
                </label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Fortuner"
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  Trim
                </label>
                <input
                  type="text"
                  value={trim}
                  onChange={(e) => setTrim(e.target.value)}
                  placeholder="LTD"
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
                />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="mb-3 text-sm font-bold text-[#102A56]">
              Condition & Valuation
            </h3>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) =>
                    handleConditionChange(e.target.value as Condition)
                  }
                  className="mt-1.5 h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                >
                  <option value="EXCELLENT">Excellent</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  Market Value
                  <span className="font-normal text-[#64748B]">
                    {" "}
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={marketValue}
                  onChange={(e) =>
                    setMarketValue(formatNumberInput(e.target.value))
                  }
                  placeholder="Leave blank for automatic estimate"
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
                />
                <p className="mt-1.5 text-xs text-[#64748B]">
                  Leave blank to estimate automatically from comparable dealer
                  inventory.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  Deduction %
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={deductionPercent}
                  onChange={(e) => {
                    setDeductionTouched(true);
                    setDeductionPercent(e.target.value.replace(/[^\d.]/g, ""));
                  }}
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
                />
                <p className="mt-1.5 text-xs text-[#64748B]">
                  Defaults by condition; edit if needed.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-[#334155]">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Minor scratches, tire condition, interior notes..."
              className="mt-1.5 w-full resize-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 py-2.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
            />
          </div>

          {previewAppraisedValue !== null && (
            <div className="mb-4 rounded-2xl border border-[#1677FF] bg-[#F5F9FD] p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#1677FF] bg-white text-[#1677FF]">
                  <DollarSignIcon className="h-4 w-4" />
                </span>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
                    Estimated Trade Value
                  </p>
                  <p className="mt-1 text-2xl font-bold text-[#102A56]">
                    {formatCurrency(previewAppraisedValue)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {formError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
            >
              <XIcon className="h-4 w-4" />
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1]"
            >
              <SaveIcon className="h-4 w-4" />
              {saving ? "Saving..." : "Save Appraisal"}
            </button>
          </div>
        </form>
      )}

      <div>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
              <RefreshIcon className="h-5 w-5 animate-spin" />
            </span>
            <p className="ml-3 text-sm font-medium text-[#64748B]">
              Loading trade appraisals...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-white p-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600">
              <XIcon className="h-5 w-5" />
            </span>

            <h3 className="mt-4 text-base font-bold text-[#102A56]">
              Unable to load trade appraisals
            </h3>

            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && appraisals.length === 0 && (
          <div className="rounded-2xl border border-[#DCE8F5] bg-white p-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
              <TradeInsIcon className="h-5 w-5" />
            </span>

            <h3 className="mt-4 text-base font-bold text-[#102A56]">
              No trade appraisals yet
            </h3>

            <p className="mt-1 text-sm text-[#64748B]">
              Create your first trade-in appraisal to start estimating vehicle
              values.
            </p>

            </div>
        )}

        {!loading && !error && appraisals.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                  <TradeInsIcon className="h-4 w-4" />
                </span>

                <div>
                  <h2 className="text-base font-bold text-[#102A56]">
                    Trade-In Appraisals
                  </h2>

                  <p className="text-xs text-[#64748B]">
                    {appraisals.length} appraisal
                    {appraisals.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={loadAppraisals}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-3 text-xs font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>

            <div className="space-y-3">
              {appraisals.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5 transition-colors hover:border-[#BFD8F2]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                          <CarIcon className="h-4 w-4" />
                        </span>

                        <p className="truncate text-sm font-semibold text-[#102A56]">
                          {a.year ? `${a.year} ` : ""}
                          {a.make} {a.model}
                          {a.trim ? ` ${a.trim}` : ""}
                        </p>
                      </div>

                      <p className="mt-2 text-xs text-[#64748B]">
                {a.vin && <>VIN: {a.vin} <span aria-hidden="true">{"\u2022"}</span></>}
                        {a.mileage !== null && (
                <>{a.mileage.toLocaleString("en-US")} km <span aria-hidden="true">{"\u2022"}</span></>
                        )}
                        Created{" "}
                        {new Date(a.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${conditionClasses(
                        a.condition,
                      )}`}
                    >
                      {a.condition}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <p className="text-xs font-semibold text-[#64748B]">
                        Market Value
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#102A56]">
                        {formatCurrency(a.market_value)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#64748B]">
                        History Score
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#102A56]">
                        {a.history_score !== null
                          ? `${a.history_score} / 100`
                          : "N/A"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#64748B]">
                        Wholesale Estimate
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#102A56]">
                        {formatCurrency(a.wholesale_estimate)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#64748B]">
                        Retail Estimate
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#102A56]">
                        {formatCurrency(a.retail_estimate)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#64748B]">
                        Trade Value
                      </p>
                      <p className="mt-1 text-sm font-bold text-[#102A56]">
                        {formatCurrency(a.appraised_value)}
                      </p>
                    </div>
                  </div>

                  {a.notes && (
                    <div className="mt-3 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-3">
                      <p className="text-xs text-[#64748B]">{a.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
