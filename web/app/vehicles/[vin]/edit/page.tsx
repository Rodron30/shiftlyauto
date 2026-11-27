"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BackButton } from "@/components/ui/BackButton";
import {
  CarIcon,
  DollarSignIcon,
  SaveIcon,
  SecurityIcon,
  SettingsIcon,
  XIcon,
  CheckIcon,
  FileTextIcon,
} from "@/components/icons";

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
  mileage_unit: string | null;
  description: string | null;
  status: string;
  primary_image: string | null;
  currency: string;
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
  mileage_unit: string;
  description: string;
  status: string;
  primary_image: string;
  currency: string;
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

  if (!integerPart) {
    integerPart = "0";
  }

  integerPart = integerPart.replace(/^0+(?=\d)/, "");

  const formattedInteger = Number(integerPart).toLocaleString("en-US");

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

function getFieldIcon(label: string): ReactNode {
  const value = label.toLowerCase();

  if (value.includes("price")) return <DollarSignIcon className="h-4 w-4" />;
  if (value.includes("mileage")) return <CarIcon className="h-4 w-4" />;
  if (value.includes("vin")) return <SecurityIcon className="h-4 w-4" />;
  return <CarIcon className="h-4 w-4" />;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: FieldProps) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
        <span className="text-[#64748B]">{getFieldIcon(label)}</span>
        {label}
        {required ? <span className="text-red-600">*</span> : null}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
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
    mileage_unit: "km",
    description: "",
    status: "AVAILABLE",
    primary_image: "",
    currency: "CAD",
  });

  const [loading, setLoading] = useState(Boolean(vin));
  const [checkingRole, setCheckingRole] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(vin ? "" : "Invalid VIN.");

  // Check user role and redirect customers
  useEffect(() => {
    async function checkRole() {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();
        if (data.profile?.role === "customer") {
          router.push("/leads");
          return;
        }
      } catch (err) {
        console.error("Failed to check user role:", err);
      } finally {
        setCheckingRole(false);
      }
    }
    checkRole();
  }, [router]);

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
          },
        );

        const result: VehicleResponse = await response.json();

        if (!response.ok || !result.success || !result.vehicle) {
          throw new Error(result.error || "Failed to load vehicle.");
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
          mileage_unit: "KM",
          description: vehicle.description ?? "",
          status: vehicle.status ?? "AVAILABLE",
          primary_image: vehicle.primary_image ?? "",
          currency: vehicle.currency ?? "CAD",
        });
      } catch (err) {
        console.error("Load vehicle error:", err);

        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load vehicle.",
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

  function updateField(field: keyof VehicleForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

      const response = await fetch(`/api/vehicles/${encodeURIComponent(vin)}`, {
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
          mileage_unit: "KM", // Force KM for Canadian market
          description: form.description,
          status: form.status,
          primary_image: form.primary_image,
          currency: "CAD", // Force CAD for Canadian market
        }),
      });

      const result: VehicleResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update vehicle.");
      }

      router.push(`/vehicles/${encodeURIComponent(vin)}`);
      router.refresh();
    } catch (err) {
      console.error("Update vehicle error:", err);

      setError(
        err instanceof Error ? err.message : "Failed to update vehicle.",
      );
    } finally {
      setSaving(false);
    }
  }

  // Don't render form while checking role
  if (checkingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F9FD] lg:pl-[15rem]">
        <div className="text-sm text-gray-600">Loading...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F9FD]">
        <div className="mx-auto w-full max-w-[1400px] px-3 py-5 sm:px-4 lg:px-5 lg:py-6">
          <p className="text-sm text-gray-600">Loading vehicle...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F9FD]">
      <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
        <div className="mb-5">
          <BackButton
            href={`/vehicles/${encodeURIComponent(vin)}`}
            label="Back to Vehicle"
          />
        </div>

        <div className="mb-5">
          <div className="rounded-2xl border border-[#DCE8F5] bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                <SettingsIcon className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">
                  Vehicle Intelligence
                </p>

                <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                  Edit Vehicle
                </h1>

                <p className="mt-1.5 text-sm text-[#64748B]">
                  Update the vehicle and inventory information.
                </p>

                <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] px-3 py-2 text-xs font-semibold text-[#475569]">
                  <SecurityIcon className="h-4 w-4 text-[#1677FF]" />
                  <span>VIN: {vin}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-white px-4 py-3">
              <XIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          <section className="rounded-2xl border border-[#DCE8F5] bg-white">
            <div className="flex items-center gap-2.5 border-b border-[#EDF2F7] px-4 py-3 sm:px-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F9FD] text-[#1677FF]">
                <CarIcon className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#102A56]">
                  Vehicle Information
                </h2>
                <p className="text-xs text-[#64748B]">
                  Update the vehicle specifications.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-5 gap-y-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                  <SecurityIcon className="h-3.5 w-3.5 text-[#64748B]" />
                  VIN
                </label>
                <input
                  value={vin}
                  readOnly
                  className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 text-sm text-[#94A3B8]"
                />
              </div>

              <Field
                label="Year"
                type="number"
                value={form.year}
                onChange={(value) => updateField("year", value)}
                min="1900"
                max="2100"
                required
              />

              <Field
                label="Make"
                value={form.make}
                onChange={(value) => updateField("make", value)}
                required
              />

              <Field
                label="Model"
                value={form.model}
                onChange={(value) => updateField("model", value)}
                required
              />

              <Field
                label="Trim"
                value={form.trim}
                onChange={(value) => updateField("trim", value)}
              />

              <Field
                label="Body"
                value={form.body}
                onChange={(value) => updateField("body", value)}
              />

              <Field
                label="Engine"
                value={form.engine}
                onChange={(value) => updateField("engine", value)}
              />

              <Field
                label="Drivetrain"
                value={form.drivetrain}
                onChange={(value) => updateField("drivetrain", value)}
              />

              <Field
                label="Fuel"
                value={form.fuel}
                onChange={(value) => updateField("fuel", value)}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#DCE8F5] bg-white">
            <div className="flex items-center gap-2.5 border-b border-[#EDF2F7] px-4 py-3 sm:px-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F9FD] text-[#1677FF]">
                <DollarSignIcon className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#102A56]">
                  Inventory Details
                </h2>
                <p className="text-xs text-[#64748B]">
                  Update pricing, mileage, and status.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-5 gap-y-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
              <Field
                label="$ Price (CAD)"
                value={form.price}
                onChange={(value) =>
                  updateField("price", formatNumberInput(value))
                }
                placeholder="1,250,000"
              />

              <Field
                label="Mileage (KM)"
                value={form.mileage}
                onChange={(value) =>
                  updateField("mileage", formatNumberInput(value))
                }
                placeholder="25,000"
              />

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                  <CheckIcon className="h-3.5 w-3.5 text-[#64748B]" />
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    updateField("status", event.target.value)
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SOLD">Sold</option>
                </select>
              </div>

              <Field
                label="Primary Image URL"
                value={form.primary_image}
                onChange={(value) => updateField("primary_image", value)}
                placeholder="https://..."
              />

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                  <FileTextIcon className="h-3.5 w-3.5 text-[#64748B]" />
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  rows={5}
                  placeholder="Describe the vehicle, condition, features, and listing details..."
                  className="w-full resize-y rounded-xl border border-[#DCE8F5] bg-white px-3.5 py-2.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
                />
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-2 border-t border-[#DCE8F5] pt-4 sm:flex-row sm:justify-end">
            <Link
              href={`/vehicles/${encodeURIComponent(vin)}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
            >
              <XIcon className="h-4 w-4" />
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-5 text-sm font-semibold text-white transition hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1]"
            >
              <SaveIcon className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}


