"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";

type VehicleForm = {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  body: string;
  engine: string;
  drivetrain: string;
  fuel: string;
  price: string;
  mileage: string;
  description: string;
  status: string;
};

function formatNumberInput(value: string) {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");

  if (!cleaned) {
    return "";
  }

  const firstDotIndex = cleaned.indexOf(".");

  let integerPart =
    firstDotIndex === -1
      ? cleaned
      : cleaned.slice(0, firstDotIndex);

  const decimalPart =
    firstDotIndex === -1
      ? ""
      : cleaned
          .slice(firstDotIndex + 1)
          .replace(/\./g, "")
          .slice(0, 2);

  if (!integerPart) {
    integerPart = "0";
  }

  integerPart = integerPart.replace(/^0+(?=\d)/, "");

  const formattedInteger = Number(integerPart).toLocaleString(
    "en-US"
  );

  if (firstDotIndex !== -1) {
    return `${formattedInteger}.${decimalPart}`;
  }

  return formattedInteger;
}

function numericValue(value: string) {
  const cleaned = value.replace(/,/g, "").trim();

  if (!cleaned) {
    return null;
  }

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  min?: string;
  max?: string;
  step?: string;
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  maxLength,
  min,
  max,
  step,
}: FieldProps) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        min={min}
        step={step}
        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
      />
    </div>
  );
}

export default function NewVehiclePage() {
  const router = useRouter();

  const [form, setForm] = useState<VehicleForm>(() => {
    const defaultForm: VehicleForm = {
      vin: "",
      year: "",
      make: "",
      model: "",
      trim: "",
      body: "",
      engine: "",
      drivetrain: "",
      fuel: "",
      price: "",
      mileage: "",
      description: "",
      status: "AVAILABLE",
    };

    if (typeof window === "undefined") {
      return defaultForm;
    }

    const params = new URLSearchParams(window.location.search);
    const vinFromUrl = params.get("vin");

    if (!vinFromUrl) {
      return defaultForm;
    }

    const normalizedVin = vinFromUrl.trim().toUpperCase();

    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalizedVin)) {
      return defaultForm;
    }

    return {
      ...defaultForm,
      vin: normalizedVin,
    };
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(
    field: keyof VehicleForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const price = numericValue(form.price);
      const mileage = numericValue(form.mileage);

      if (form.price.trim() && price === null) {
        throw new Error("Please enter a valid price.");
      }

      if (form.mileage.trim() && mileage === null) {
        throw new Error("Please enter a valid mileage.");
      }

      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          price,
          mileage,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to create vehicle."
        );
      }

      router.push("/vehicles");
      router.refresh();
    } catch (err) {
      console.error("Create vehicle error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create vehicle."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <AppHeader />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6">
          <Link
            href="/vehicles"
            className="text-sm font-semibold text-gray-600 transition hover:text-gray-900"
          >
            Back to Vehicles
          </Link>


          <p className="mt-6 text-sm font-medium text-gray-500">
            Vehicle Intelligence
          </p>

          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Add Vehicle
          </h1>

          <p className="mt-2 text-gray-600">
            Add a vehicle to your dealership inventory.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">
                {error}
              </p>
            </div>
          )}

          <section>
            <h2 className="text-lg font-semibold text-gray-900">
              Vehicle Information
            </h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field
                label="VIN"
                value={form.vin}
                onChange={(value) =>
                  updateField("vin", value.toUpperCase())
                }
                placeholder="17-character VIN"
                required
                maxLength={17}
              />

              <Field
                label="Year"
                type="number"
                value={form.year}
                onChange={(value) =>
                  updateField("year", value)
                }
                placeholder="2023"
                required
                min="1900"
                max="2100"
              />

              <Field
                label="Make"
                value={form.make}
                onChange={(value) =>
                  updateField("make", value)
                }
                placeholder="Honda"
                required
              />

              <Field
                label="Model"
                value={form.model}
                onChange={(value) =>
                  updateField("model", value)
                }
                placeholder="Civic"
                required
              />

              <Field
                label="Trim"
                value={form.trim}
                onChange={(value) =>
                  updateField("trim", value)
                }
                placeholder="Sport"
              />

              <Field
                label="Body"
                value={form.body}
                onChange={(value) =>
                  updateField("body", value)
                }
                placeholder="Sedan"
              />

              <Field
                label="Engine"
                value={form.engine}
                onChange={(value) =>
                  updateField("engine", value)
                }
                placeholder="2.0L I4"
              />

              <Field
                label="Drivetrain"
                value={form.drivetrain}
                onChange={(value) =>
                  updateField("drivetrain", value)
                }
                placeholder="FWD"
              />

              <Field
                label="Fuel"
                value={form.fuel}
                onChange={(value) =>
                  updateField("fuel", value)
                }
                placeholder="Gasoline"
              />
            </div>
          </section>

          <section className="mt-8 border-t border-gray-200 pt-8">
            <h2 className="text-lg font-semibold text-gray-900">
              Inventory Details
            </h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field
                label="Price"
                value={form.price}
                onChange={(value) =>
                  updateField(
                    "price",
                    formatNumberInput(value)
                  )
                }
                placeholder="1,250,000"
              />

              <Field
                label="Mileage (km)"
                value={form.mileage}
                onChange={(value) =>
                  updateField(
                    "mileage",
                    formatNumberInput(value)
                  )
                }
                placeholder="25,000"
              />

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Status
                </label>

                <select
                  value={form.status}
                  onChange={(event) =>
                    updateField(
                      "status",
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                >
                  <option value="AVAILABLE">
                    Available
                  </option>
                  <option value="DRAFT">
                    Draft
                  </option>
                  <option value="SOLD">
                    Sold
                  </option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">
                  Description
                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateField(
                      "description",
                      event.target.value
                    )
                  }
                  rows={5}
                  placeholder="Describe the vehicle, condition, features, and other listing details..."
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                />
              </div>
            </div>
          </section>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
            <Link
              href="/vehicles"
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

