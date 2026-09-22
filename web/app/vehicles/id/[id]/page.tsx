"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Vehicle = {
  id: string;
  vin: string | null;
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
  location: string | null;
  status: string | null;
  primary_image: string | null;
  images: string[];
};

export default function VehicleByIdPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || "");

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (!id) return;

    async function loadVehicle() {
      try {
        const response = await fetch(
          `/api/vehicles/id/${encodeURIComponent(id)}`,
          { cache: "no-store" }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to load vehicle.");
        }

        setVehicle(result.vehicle);
      } catch (err) {
        console.error("Vehicle detail load error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load vehicle."
        );
      } finally {
        setLoading(false);
      }
    }

    loadVehicle();
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-gray-500">Loading vehicle...</p>
      </main>
    );
  }

  if (error || !vehicle) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <button
          type="button"
          onClick={() => router.push("/vehicles")}
          className="mb-6 text-sm text-gray-600 hover:text-gray-900"
        >
          Back to Inventory
        </button>

        <div className="rounded-lg border border-red-200 bg-red-50 p-5">
          <h1 className="font-semibold text-red-800">
            Vehicle not found
          </h1>
          <p className="mt-1 text-sm text-red-700">
            {error || "This vehicle could not be loaded."}
          </p>
        </div>
      </main>
    );
  }

  const formattedPrice =
    vehicle.price !== null
      ? (() => {
          const currencyCode = vehicle.currency || "CAD";

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
          }).format(vehicle.price);
        })()
      : "Not set";

  const formattedMileage =
    vehicle.mileage !== null
      ? `${Number(vehicle.mileage).toLocaleString()} ${
          vehicle.mileage_unit || ""
        }`.trim()
      : "Not set";

  const galleryImages =
    Array.isArray(vehicle.images) && vehicle.images.length > 0
      ? vehicle.images
      : vehicle.primary_image
        ? [vehicle.primary_image]
        : [];

  const showPreviousImage = () => {
    setActiveImageIndex((current) =>
      current === 0 ? galleryImages.length - 1 : current - 1
    );
  };

  const showNextImage = () => {
    setActiveImageIndex((current) =>
      current === galleryImages.length - 1 ? 0 : current + 1
    );
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <button
        type="button"
        onClick={() => router.push("/vehicles")}
        className="mb-6 text-sm text-gray-600 hover:text-gray-900"
      >
        Back to Inventory
      </button>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 bg-neutral-50 p-4">
          {galleryImages.length > 0 ? (
            <>
              <div className="relative overflow-hidden rounded-lg bg-white">
                <img
                  src={galleryImages[activeImageIndex]}
                  alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} photo ${activeImageIndex + 1}`}
                  className="h-80 w-full object-contain"
                />

                {galleryImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={showPreviousImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-4 py-2 text-lg font-semibold text-white hover:bg-black/80"
                      aria-label="Previous photo"
                    >
                      ←
                    </button>

                    <button
                      type="button"
                      onClick={showNextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-4 py-2 text-lg font-semibold text-white hover:bg-black/80"
                      aria-label="Next photo"
                    >
                      →
                    </button>

                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                      {activeImageIndex + 1} / {galleryImages.length}
                    </div>
                  </>
                )}
              </div>

              {galleryImages.length > 1 && (
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                  {galleryImages.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => setActiveImageIndex(index)}
                      className={`overflow-hidden rounded-md border bg-white ${
                        index === activeImageIndex
                          ? "border-blue-600 ring-2 ring-blue-200"
                          : "border-neutral-200"
                      }`}
                      aria-label={`View photo ${index + 1}`}
                    >
                      <img
                        src={image}
                        alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} photo ${index + 1}`}
                        className="h-20 w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-80 w-full items-center justify-center rounded-lg bg-neutral-100">
              <span className="text-sm text-neutral-500">
                No vehicle photos available
              </span>
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Inventory Vehicle
              </p>

              <h1 className="mt-1 text-2xl font-semibold text-gray-900">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h1>

              {vehicle.trim && (
                <p className="mt-1 text-sm text-gray-500">
                  {vehicle.trim}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                VIN
              </p>
              <p className="mt-1 font-semibold text-amber-900">
                {vehicle.vin || "Pending"}
              </p>

              {!vehicle.vin && (
                <p className="mt-1 text-xs text-amber-700">
                  History and report features require a VIN.
                </p>
              )}
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">Price</p>
              <p className="mt-1 font-medium text-gray-900">
                {formattedPrice}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">Mileage</p>
              <p className="mt-1 font-medium text-gray-900">
                {formattedMileage}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">Status</p>
              <p className="mt-1 font-medium text-gray-900">
                {vehicle.status || "Not set"}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">Fuel</p>
              <p className="mt-1 font-medium text-gray-900">
                {vehicle.fuel || "Not set"}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">Body</p>
              <p className="mt-1 font-medium text-gray-900">
                {vehicle.body || "Not set"}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">Engine</p>
              <p className="mt-1 font-medium text-gray-900">
                {vehicle.engine || "Not set"}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">Drivetrain</p>
              <p className="mt-1 font-medium text-gray-900">
                {vehicle.drivetrain || "Not set"}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">Location</p>
              <p className="mt-1 font-medium text-gray-900">
                {vehicle.location || "Not set"}
              </p>
            </div>
          </div>

          <div className="mt-8 border-t border-gray-200 pt-6">
            <h2 className="text-sm font-semibold text-gray-900">
              Description
            </h2>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
              {vehicle.description || "No description available."}
            </p>
          </div>

          {!vehicle.vin && (
            <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900">
                VIN required for vehicle history
              </p>

              <p className="mt-1 text-sm text-gray-600">
                Once the VIN is available, this vehicle can continue
                through the history, AI analysis, and customer report
                workflow.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

