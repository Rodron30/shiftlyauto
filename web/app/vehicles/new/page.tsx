"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

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
      if (params.get("drivetrain")) defaultForm.drivetrain = params.get("drivetrain") || "";
      if (params.get("transmission")) defaultForm.transmission = params.get("transmission") || "";
      if (params.get("fuel")) defaultForm.fuel = params.get("fuel") || "";
      if (params.get("price")) defaultForm.price = params.get("price") || "";
      if (params.get("mileage")) defaultForm.mileage = params.get("mileage") || "";
      if (params.get("description")) defaultForm.description = params.get("description") || "";
      if (params.get("location")) defaultForm.location = params.get("location") || "";
    }

    return defaultForm;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (accessDenied) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h1 className="text-lg font-semibold text-amber-900 mb-2">Access Denied</h1>
          <p className="text-amber-700 mb-4">
            Customers do not have access to create vehicles. Redirecting to Leads...
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
        err instanceof Error
          ? err.message
          : "Failed to create vehicle."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Add Vehicle</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add a new vehicle to your inventory.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              VIN
            </label>
            <input
              type="text"
              value={form.vin}
              onChange={(e) => setForm({ ...form, vin: e.target.value.toUpperCase() })}
              placeholder="Vehicle Identification Number"
              maxLength={17}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <input
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              placeholder="2024"
              min="1900"
              max="2099"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Make
            </label>
            <input
              type="text"
              value={form.make}
              onChange={(e) => setForm({ ...form, make: e.target.value })}
              placeholder="Toyota"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model
            </label>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="Camry"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trim
            </label>
            <input
              type="text"
              value={form.trim}
              onChange={(e) => setForm({ ...form, trim: e.target.value })}
              placeholder="LE"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Body Style
            </label>
            <input
              type="text"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Sedan"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price
            </label>
            <input
              type="text"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: formatNumberInput(e.target.value) })}
              placeholder="25,000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mileage
            </label>
            <input
              type="text"
              value={form.mileage}
              onChange={(e) => setForm({ ...form, mileage: formatNumberInput(e.target.value) })}
              placeholder="50,000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mileage Unit
            </label>
            <select
              value={form.mileageUnit}
              onChange={(e) => setForm({ ...form, mileageUnit: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="KM">KM</option>
              <option value="MI">MI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fuel Type
            </label>
            <input
              type="text"
              value={form.fuel}
              onChange={(e) => setForm({ ...form, fuel: e.target.value })}
              placeholder="Gasoline"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transmission
            </label>
            <input
              type="text"
              value={form.transmission}
              onChange={(e) => setForm({ ...form, transmission: e.target.value })}
              placeholder="Automatic"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Drivetrain
            </label>
            <input
              type="text"
              value={form.drivetrain}
              onChange={(e) => setForm({ ...form, drivetrain: e.target.value })}
              placeholder="FWD"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Engine
            </label>
            <input
              type="text"
              value={form.engine}
              onChange={(e) => setForm({ ...form, engine: e.target.value })}
              placeholder="2.5L"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="AVAILABLE">Available</option>
              <option value="DRAFT">Draft</option>
              <option value="SOLD">Sold</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Vehicle description..."
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Toronto, ON"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Vehicle"}
          </button>

          <Link
            href="/vehicles"
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
