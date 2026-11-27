"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { BackButton } from "@/components/ui/BackButton";
import {
  XIcon,
  SaveIcon,
  CarIcon,
  CalendarIcon,
  CheckIcon,
  DollarSignIcon,
  FileTextIcon,
  VehiclesIcon,
  BuildingIcon,
} from "@/components/icons";

type VehicleForm = {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  body: string;
  engine: string;
  drivetrain: string;
  transmission: string;
  fuel: string;
  price: string;
  currency: string;
  mileage: string;
  mileageUnit: string;
  primary_image: string;
  images: string[];
  description: string;
  location: string;
  status: string;
};

function formatNumberInput(value: string) {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");

  if (!cleaned) {
    return "";
  }

  const firstDotIndex = cleaned.indexOf(".");

  const integerPart =
    firstDotIndex === -1 ? cleaned : cleaned.slice(0, firstDotIndex);

  const decimalPart =
    firstDotIndex === -1
      ? ""
      : cleaned
          .slice(firstDotIndex + 1)
          .replace(/\./g, "")
          .slice(0, 2);

  return integerPart + (decimalPart ? `.${decimalPart}` : "");
}

export default function NewVehiclePage() {
  const router = useRouter();
  const [accessDenied, setAccessDenied] = useState(false);
  const { showToast } = useToast();

  // Check user role and redirect if customer
  useEffect(() => {
    async function checkAccess() {
      try {
        const response = await fetch("/api/auth/session");
        const result = await response.json();

        if (result.profile?.role === "customer") {
          setAccessDenied(true);
          return;
        }
      } catch (err) {
        console.error("Failed to check user role:", err);
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
      transmission: "",
      fuel: "",
      price: "",
      currency: "CAD",
      mileage: "",
      primary_image: "",
      images: [],
      mileageUnit: "KM",
      description: "",
      location: "",
      status: "AVAILABLE",
    };

    // Initialize from URL parameters if provided
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("vin")) defaultForm.vin = params.get("vin") || "";
      if (params.get("year")) defaultForm.year = params.get("year") || "";
      if (params.get("make")) defaultForm.make = params.get("make") || "";
      if (params.get("model")) defaultForm.model = params.get("model") || "";
      if (params.get("trim")) defaultForm.trim = params.get("trim") || "";
      if (params.get("body")) defaultForm.body = params.get("body") || "";
      if (params.get("engine")) defaultForm.engine = params.get("engine") || "";
      if (params.get("drivetrain"))
        defaultForm.drivetrain = params.get("drivetrain") || "";
      if (params.get("transmission"))
        defaultForm.transmission = params.get("transmission") || "";
      if (params.get("fuel")) defaultForm.fuel = params.get("fuel") || "";
      if (params.get("price")) defaultForm.price = params.get("price") || "";
      if (params.get("mileage"))
        defaultForm.mileage = params.get("mileage") || "";
      if (params.get("description"))
        defaultForm.description = params.get("description") || "";
      if (params.get("location"))
        defaultForm.location = params.get("location") || "";

      if (params.get("primary_image")) {
        defaultForm.primary_image = params.get("primary_image") || "";
      }

      const imagesParam = params.get("images");

      if (imagesParam) {
        try {
          const parsedImages = JSON.parse(imagesParam);

          if (Array.isArray(parsedImages)) {
            defaultForm.images = parsedImages.filter(
              (image) => typeof image === "string" && image.trim(),
            );
          }
        } catch (error) {
          console.error("Failed to parse vehicle images:", error);
        }
      }
    }

    return defaultForm;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const imagesParam = params.get("images");
    const primaryImageParam = params.get("primary_image");

    let parsedImages: string[] = [];

    if (imagesParam) {
      try {
        const parsed = JSON.parse(imagesParam);
        if (Array.isArray(parsed)) {
          parsedImages = parsed.filter(
            (image): image is string =>
              typeof image === "string" && image.trim().length > 0,
          );
        }
      } catch (error) {
        console.error("Failed to hydrate vehicle images:", error);
      }
    }

    if (parsedImages.length > 0 || primaryImageParam) {
      setTimeout(() => {
        setForm((current) => ({
          ...current,
          primary_image: primaryImageParam || current.primary_image,
          images: parsedImages.length > 0 ? parsedImages : current.images,
        }));
      }, 0);
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (accessDenied) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <div className="rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] p-4 shadow-sm">
          <h1 className="text-xs sm:text-sm font-semibold text-[#102A56] mb-2">
            Access Denied
          </h1>
          <p className="text-[10px] sm:text-xs text-[#1E3A5F] mb-3">
            Customers do not have access to create vehicles. Redirecting to
            Leads...
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vin: form.vin || null,
          year: form.year ? Number(form.year) : null,
          make: form.make || null,
          model: form.model || null,
          trim: form.trim || null,
          body: form.body || null,
          engine: form.engine || null,
          drivetrain: form.drivetrain || null,
          transmission: form.transmission || null,
          fuel: form.fuel || null,
          price: form.price ? Number(form.price.replace(/,/g, "")) : null,
          currency: form.currency,
          mileage: form.mileage ? Number(form.mileage.replace(/,/g, "")) : null,
          mileage_unit: form.mileageUnit,
          primary_image: form.primary_image || null,
          images: form.images || [],
          description: form.description || null,
          location: form.location || null,
          status: form.status || "AVAILABLE",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to create vehicle.");
      }

      showToast("success", "Vehicle created successfully!");

      const vin = form.vin || result.vehicle?.id;
      if (vin) {
        router.push(`/vehicles/${encodeURIComponent(vin)}`);
      } else {
        router.push("/vehicles");
      }
    } catch (err) {
      console.error("Create vehicle error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create vehicle.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
      <div className="mb-5">
        <BackButton href="/vehicles" label="Back to Vehicles" />
      </div>

      <div className="mb-5">
        <div className="rounded-2xl border border-[#DCE8F5] bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
              <CarIcon className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">
                Vehicle Intelligence
              </p>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                Add Vehicle
              </h1>

              <p className="mt-1.5 text-sm text-[#64748B]">
                Add a new vehicle to your inventory.
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-white px-4 py-3">
          <XIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
                Enter the vehicle specifications and inventory details.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-5 gap-y-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <CarIcon className="h-3.5 w-3.5 text-[#64748B]" />
                VIN
              </label>
              <input
                type="text"
                value={form.vin}
                onChange={(e) =>
                  setForm({ ...form, vin: e.target.value.toUpperCase() })
                }
                placeholder="17-character VIN"
                maxLength={17}
                className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <CalendarIcon className="h-3.5 w-3.5 text-[#64748B]" />
                Year
              </label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                placeholder="2024"
                min="1900"
                max="2099"
                className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <VehiclesIcon className="h-3.5 w-3.5 text-[#64748B]" />
                Make
                <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={form.make}
                onChange={(e) => setForm({ ...form, make: e.target.value })}
                placeholder="Toyota"
                className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <VehiclesIcon className="h-3.5 w-3.5 text-[#64748B]" />
                Model
                <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="Camry"
                className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <VehiclesIcon className="h-3.5 w-3.5 text-[#64748B]" />
                Trim
              </label>
              <input
                type="text"
                value={form.trim}
                onChange={(e) => setForm({ ...form, trim: e.target.value })}
                placeholder="LE"
                className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <VehiclesIcon className="h-3.5 w-3.5 text-[#64748B]" />
                Body Style
              </label>
              <input
                type="text"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Sedan"
                className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <DollarSignIcon className="h-3.5 w-3.5 text-[#64748B]" />
                $ Price (CAD)
              </label>
              <input
                type="text"
                value={form.price}
                onChange={(e) =>
                  setForm({
                    ...form,
                    price: formatNumberInput(e.target.value),
                  })
                }
                placeholder="25,000"
                inputMode="decimal"
                className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
              />
            </div><div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <VehiclesIcon className="h-3.5 w-3.5 text-[#64748B]" />
                Mileage (KM)
              </label>
              <input
                type="text"
                value={form.mileage}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mileage: formatNumberInput(e.target.value),
                  })
                }
                placeholder="50,000"
                inputMode="decimal"
                className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
              />
            </div><div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <VehiclesIcon className="h-3.5 w-3.5 text-[#64748B]" />
                Fuel Type
              </label>
              <input
                type="text"
                value={form.fuel}
                onChange={(e) => setForm({ ...form, fuel: e.target.value })}
                placeholder="Gasoline"
                className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <VehiclesIcon className="h-3.5 w-3.5 text-[#64748B]" />
                Transmission
              </label>
              <input
                type="text"
                value={form.transmission}
                onChange={(e) =>
                  setForm({ ...form, transmission: e.target.value })
                }
                placeholder="Automatic"
                className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <VehiclesIcon className="h-3.5 w-3.5 text-[#64748B]" />
                Drivetrain
              </label>
              <input
                type="text"
                value={form.drivetrain}
                onChange={(e) =>
                  setForm({ ...form, drivetrain: e.target.value })
                }
                placeholder="FWD"
                className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <VehiclesIcon className="h-3.5 w-3.5 text-[#64748B]" />
                Engine
              </label>
              <input
                type="text"
                value={form.engine}
                onChange={(e) => setForm({ ...form, engine: e.target.value })}
                placeholder="2.5L"
                className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <CheckIcon className="h-3.5 w-3.5 text-[#64748B]" />
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
              >
                <option value="AVAILABLE">Available</option>
                <option value="DRAFT">Draft</option>
                <option value="SOLD">Sold</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#DCE8F5] bg-white">
          <div className="flex items-center gap-2.5 border-b border-[#EDF2F7] px-4 py-3 sm:px-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F9FD] text-[#1677FF]">
              <FileTextIcon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#102A56]">
                Additional Details
              </h2>
              <p className="text-xs text-[#64748B]">
                Add listing information and vehicle location.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_320px]">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <FileTextIcon className="h-3.5 w-3.5 text-[#64748B]" />
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Add vehicle description, features, condition, and notes..."
                rows={5}
                className="w-full resize-y rounded-xl border border-[#DCE8F5] bg-white px-3.5 py-2.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#334155]">
                <BuildingIcon className="h-3.5 w-3.5 text-[#64748B]" />
                Location
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Toronto, ON"
                className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 placeholder:text-[#94A3B8]"
              />
            </div>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-2 border-t border-[#DCE8F5] pt-4 sm:flex-row sm:justify-end">
          <Link
            href="/vehicles"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
          >
            <XIcon className="h-4 w-4" />
            Cancel
          </Link>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-5 text-sm font-semibold text-white transition hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1]"
          >
            <SaveIcon className="h-4 w-4" />
            {loading ? "Creating..." : "Create Vehicle"}
          </button>
        </div>
      </form>
    </div>
  );
}




