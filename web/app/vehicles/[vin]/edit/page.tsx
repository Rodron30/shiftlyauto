"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";

type Vehicle = {
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
  status: string;
  primary_image: string | null;
};

type VehicleResponse = {
  success: boolean;
  vehicle?: Vehicle;
  error?: string;
};

type VehicleForm = {
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
  primary_image: string;
};

function formatNumberInput(value: string) {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");

  if (!cleaned) return "";

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

  return firstDotIndex !== -1
    ? `${formattedInteger}.${decimalPart}`
    : formattedInteger;
}

function numericValue(value: string) {
  const cleaned = value.replace(/,/g, "").trim();

  if (!cleaned) return null;

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
  min?: string;
  max?: string;
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  min,
  max,
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
        min={min}
        max={max}
        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
      />
    </div>
  );
}

export default function EditVehiclePage() {
  const params = useParams<{ vin: string }>();
  const router = useRouter();

  const vin = decodeURIComponent(params.vin ?? "")
    .trim()
    .toUpperCase();

  const [form, setForm] = useState<VehicleForm>({
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
    primary_image: "",
  });

  const [loading, setLoading] = useState(Boolean(vin));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(
    vin ? "" : "Invalid VIN."
  );

  useEffect(() => {
    if (!vin) {
      return;
    }

    let cancelled = false;

    async function loadVehicle() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/vehicles/${encodeURIComponent(vin)}`,
          {
            cache: "no-store",
          }
        );

        const result: VehicleResponse =
          await response.json();

        if (!response.ok || !result.success || !result.vehicle) {
          throw new Error(
            result.error || "Failed to load vehicle."
          );
        }

        const vehicle = result.vehicle;

        if (cancelled) {
          return;
        }

        setForm({
          year: String(vehicle.year ?? ""),
          make: vehicle.make ?? "",
          model: vehicle.model ?? "",
          trim: vehicle.trim ?? "",
          body: vehicle.body ?? "",
          engine: vehicle.engine ?? "",
          drivetrain: vehicle.drivetrain ?? "",
          fuel: vehicle.fuel ?? "",
          price:
            vehicle.price == null
              ? ""
              : Number(vehicle.price).toLocaleString("en-US"),
          mileage:
            vehicle.mileage == null
              ? ""
              : Number(vehicle.mileage).toLocaleString("en-US"),
          description: vehicle.description ?? "",
          status: vehicle.status ?? "AVAILABLE",
          primary_image: vehicle.primary_image ?? "",
        });
      } catch (err) {
        console.error("Load vehicle error:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load vehicle."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadVehicle();

    return () => {
      cancelled = true;
    };
  }, [vin]);

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

      const response = await fetch(
        `/api/vehicles/${encodeURIComponent(vin)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            year: form.year,
            make: form.make,
            model: form.model,
            trim: form.trim,
            body: form.body,
            engine: form.engine,
            drivetrain: form.drivetrain,
            fuel: form.fuel,
            price,
            mileage,
            description: form.description,
            status: form.status,
            primary_image: form.primary_image,
          }),
        }
      );

      const result: VehicleResponse =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to update vehicle."
        );
      }

      router.push(
        `/vehicles/${encodeURIComponent(vin)}`
      );
      router.refresh();
    } catch (err) {
      console.error("Update vehicle error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update vehicle."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100">
        <AppHeader />

        <div className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-sm text-gray-600">
            Loading vehicle...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <AppHeader />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6">
          <Link
            href={`/vehicles/${encodeURIComponent(vin)}`}
            className="text-sm font-semibold text-gray-600 transition hover:text-gray-900"
          >
            Back to Vehicle
          </Link>

          <p className="mt-6 text-sm font-medium text-gray-500">
            Inventory
          </p>

          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Edit Vehicle
          </h1>

          <p className="mt-2 text-gray-600">
            Update the vehicle and inventory information.
          </p>

          <p className="mt-2 text-sm font-medium text-gray-500">
            VIN: {vin}
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
              <div>
                <label className="text-sm font-medium text-gray-700">
                  VIN
                </label>

                <input
                  value={vin}
                  readOnly
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2.5 text-sm text-gray-500"
                />
              </div>

              <Field
                label="Year"
                type="number"
                value={form.year}
                onChange={(value) =>
                  updateField("year", value)
                }
                min="1900"
                max="2100"
                required
              />

              <Field
                label="Make"
                value={form.make}
                onChange={(value) =>
                  updateField("make", value)
                }
                required
              />

              <Field
                label="Model"
                value={form.model}
                onChange={(value) =>
                  updateField("model", value)
                }
                required
              />

              <Field
                label="Trim"
                value={form.trim}
                onChange={(value) =>
                  updateField("trim", value)
                }
              />

              <Field
                label="Body"
                value={form.body}
                onChange={(value) =>
                  updateField("body", value)
                }
              />

              <Field
                label="Engine"
                value={form.engine}
                onChange={(value) =>
                  updateField("engine", value)
                }
              />

              <Field
                label="Drivetrain"
                value={form.drivetrain}
                onChange={(value) =>
                  updateField("drivetrain", value)
                }
              />

              <Field
                label="Fuel"
                value={form.fuel}
                onChange={(value) =>
                  updateField("fuel", value)
                }
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

              <Field
                label="Primary Image URL"
                value={form.primary_image}
                onChange={(value) =>
                  updateField(
                    "primary_image",
                    value
                  )
                }
                placeholder="https://..."
              />

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
                  placeholder="Describe the vehicle, condition, features, and listing details..."
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                />
              </div>
            </div>
          </section>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
            <Link
              href={`/vehicles/${encodeURIComponent(vin)}`}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}