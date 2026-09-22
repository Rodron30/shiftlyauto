"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
    String(DEFAULT_DEDUCTION.GOOD)
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
        throw new Error(
          result.error || "Failed to load trade appraisals."
        );
      }

      setAppraisals(result.appraisals ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load trade appraisals."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppraisals();
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
        throw new Error(
          result.error || "Failed to save trade appraisal."
        );
      }

      resetForm();
      setShowForm(false);
      await loadAppraisals();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to save trade appraisal."
      );
    } finally {
      setSaving(false);
    }
  };

  const conditionBadgeClasses: Record<string, string> = {
    EXCELLENT: "bg-green-100 text-green-700",
    GOOD: "bg-blue-100 text-blue-700",
    FAIR: "bg-amber-100 text-amber-700",
    POOR: "bg-red-100 text-red-700",
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-neutral-500">
            Vehicle Intelligence
          </p>

          <h1 className="mt-1 text-xl font-semibold text-neutral-900">
            Trade-In Appraisals
          </h1>

          <p className="mt-2 max-w-2xl text-xs text-neutral-600">
            Estimate a customer trade-in using market value,
            vehicle history, condition, and valuation estimates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center justify-center rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-800"
        >
          {showForm ? "Cancel" : "+ New Appraisal"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
        >
          <p className="text-[10px] text-neutral-500">
            Internal appraisal estimate. Final trade value should be
            reviewed by dealership management.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[10px] font-medium text-neutral-500">
                VIN (optional)
              </label>
              <input
                type="text"
                value={vin}
                onChange={(e) =>
                  setVin(
                    e.target.value
                      .toUpperCase()
                      .replace(/\s+/g, "")
                  )
                }
                maxLength={17}
                placeholder="17-character VIN"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-neutral-500">
                Year
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={year}
                onChange={(e) =>
                  setYear(e.target.value.replace(/\D/g, ""))
                }
                placeholder="2020"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-neutral-500">
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
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
              />
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[10px] font-medium text-neutral-500">
                Make*
              </label>
              <input
                type="text"
                  required
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="Toyota"
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-neutral-500">
                  Model*
                </label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Fortuner"
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-neutral-500">
                  Trim
                </label>
                <input
                  type="text"
                  value={trim}
                  onChange={(e) => setTrim(e.target.value)}
                  placeholder="LTD"
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-[10px] font-medium text-neutral-500">
                  Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) =>
                    handleConditionChange(
                      e.target.value as Condition
                    )
                  }
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                >
                  <option value="EXCELLENT">Excellent</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-neutral-500">
                  Market Value (optional)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={marketValue}
                  onChange={(e) =>
                    setMarketValue(
                      formatNumberInput(e.target.value)
                    )
                  }
                  placeholder="Leave blank for automatic estimate"
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                />
                <p className="mt-1 text-[10px] text-neutral-400">
                  Blank = estimate from comparable dealer inventory.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-neutral-500">
                  Deduction %
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={deductionPercent}
                  onChange={(e) => {
                    setDeductionTouched(true);
                    setDeductionPercent(
                      e.target.value.replace(/[^\d.]/g, "")
                    );
                  }}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                />
                <p className="mt-1 text-[10px] text-neutral-400">
                  Defaults by condition; edit if needed.
                </p>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-[10px] font-medium text-neutral-500">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Minor scratches, tire condition, interior notes..."
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
              />
            </div>

            {previewAppraisedValue !== null && (
              <div className="mt-3 rounded-md bg-neutral-50 p-3">
                <p className="text-[10px] font-medium text-neutral-500">
                  Estimated Trade Value
                </p>
                <p className="mt-1 text-lg font-bold text-neutral-900">
                  {formatCurrency(previewAppraisedValue)}
                </p>
              </div>
            )}

            {formError && (
              <p className="mt-3 text-xs text-red-600">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="mt-3 rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {saving ? "Saving..." : "Save Appraisal"}
            </button>
          </form>
        )}

        <div className="mt-6">
          {loading && (
            <p className="text-xs text-neutral-500">
              Loading trade appraisals...
            </p>
          )}

          {!loading && error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          {!loading && !error && appraisals.length === 0 && (
            <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-xs text-neutral-500 shadow-sm">
              No trade appraisals yet. Click &quot;+ New Appraisal&quot;
              to create one.
            </div>
          )}

          {!loading && !error && appraisals.length > 0 && (
            <div className="space-y-2">
              {appraisals.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-neutral-900">
                        {a.year ? `${a.year} ` : ""}
                        {a.make} {a.model}
                        {a.trim ? ` ${a.trim}` : ""}
                      </p>

                      <p className="mt-1 text-[10px] text-neutral-500">
                        {a.vin && <>VIN: {a.vin} - </>}
                        {a.mileage !== null && (
                          <>
                            {a.mileage.toLocaleString("en-US")} km -{" "}
                          </>
                        )}
                        {new Date(a.created_at).toLocaleDateString(
                          "en-US"
                        )}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        conditionBadgeClasses[a.condition] ||
                        "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {a.condition}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <p className="text-[10px] font-medium text-neutral-500">
                        Market Value
                      </p>
                      <p className="mt-1 text-xs font-semibold text-neutral-900">
                        {formatCurrency(a.market_value)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-medium text-neutral-500">
                        History Score
                      </p>
                      <p className="mt-1 text-xs font-semibold text-neutral-900">
                        {a.history_score !== null
                          ? `${a.history_score} / 100`
                          : "N/A"}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-medium text-neutral-500">
                        Wholesale Estimate
                      </p>
                      <p className="mt-1 text-xs font-semibold text-neutral-900">
                        {formatCurrency(a.wholesale_estimate)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-medium text-neutral-500">
                        Retail Estimate
                      </p>
                      <p className="mt-1 text-xs font-semibold text-neutral-900">
                        {formatCurrency(a.retail_estimate)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-medium text-neutral-500">
                        Trade Value
                      </p>
                      <p className="mt-1 text-sm font-bold text-neutral-900">
                        {formatCurrency(a.appraised_value)}
                      </p>
                    </div>
                  </div>

                  {a.notes && (
                    <p className="mt-2 text-xs text-neutral-600">
                      {a.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}


