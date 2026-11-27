/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BackButton } from "@/components/ui/BackButton";
import VehicleImagePlaceholder from "@/components/VehicleImagePlaceholder";
import { XIcon, ClockIcon } from "@/components/icons";

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
          { cache: "no-store" },
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to load vehicle.");
        }

        setVehicle(result.vehicle);
      } catch (err) {
        console.error("Vehicle detail load error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load vehicle.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadVehicle();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
        <div className="rounded-2xl border border-[#DCE8F5] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <ClockIcon className="h-5 w-5 animate-spin text-[#1677FF]" />
            <p className="text-sm font-medium text-[#102A56]">
              Loading vehicle...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
        <div className="mb-5">
          <BackButton href="/vehicles" label="Back to Vehicles" />
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-white px-4 py-3">
          <XIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <h1 className="text-sm font-semibold text-[#102A56]">
              Vehicle not found
            </h1>
            <p className="mt-1 text-xs text-[#1E3A5F]">
              {error || "This vehicle could not be loaded."}
            </p>
          </div>
        </div>
      </div>
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
      current === 0 ? galleryImages.length - 1 : current - 1,
    );
  };

  const showNextImage = () => {
    setActiveImageIndex((current) =>
      current === galleryImages.length - 1 ? 0 : current + 1,
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
      <div className="mb-5">
        <BackButton href="/vehicles" label="Back to Vehicles" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#DCE8F5] bg-white">
        <div className="border-b border-[#EDF2F7] bg-[#F5F9FD] p-4">
          {galleryImages.length > 0 ? (
            <>
              <div className="relative overflow-hidden rounded-2xl bg-white">
                <img
                  src={galleryImages[activeImageIndex]}
                  alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} photo ${activeImageIndex + 1}`}
                  className="h-72 sm:h-80 w-full object-contain"
                />

                {galleryImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={showPreviousImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black/80"
                      aria-label="Previous photo"
                    >
                      ←
                    </button>

                    <button
                      type="button"
                      onClick={showNextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black/80"
                      aria-label="Next photo"
                    >
                      →
                    </button>

                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] sm:text-xs font-medium text-white">
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
                      className={`overflow-hidden rounded-xl border bg-white ${
                        index === activeImageIndex
                          ? "border-[#1677FF] ring-2 ring-[#1677FF]/20"
                          : "border-[#DCE8F5]"
                      }`}
                      aria-label={`View photo ${index + 1}`}
                    >
                      <img
                        src={image}
                        alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} photo ${index + 1}`}
                        className="h-16 sm:h-20 w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <VehicleImagePlaceholder className="h-72 w-full rounded-2xl sm:h-80" />
          )}
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">
                Vehicle Intelligence
              </p>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h1>

              {vehicle.trim && (
                <p className="mt-1 text-sm text-[#64748B]">{vehicle.trim}</p>
              )}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 sm:px-4 sm:py-3">
              <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-amber-700">
                VIN
              </p>
              <p className="mt-0.5 sm:mt-1 font-semibold text-amber-900 text-xs sm:text-sm">
                {vehicle.vin || "Pending"}
              </p>

              {!vehicle.vin && (
                <p className="mt-1 text-[10px] sm:text-xs text-amber-700">
                  History and report features require a VIN.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-[10px] text-[#64748B]">Price</p>
              <p className="mt-1 font-medium text-[#102A56] text-xs sm:text-sm">
                {formattedPrice}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-[#64748B]">Mileage</p>
              <p className="mt-1 font-medium text-[#102A56] text-xs sm:text-sm">
                {formattedMileage}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-[#64748B]">Status</p>
              <p className="mt-1 font-medium text-[#102A56] text-xs sm:text-sm">
                {vehicle.status || "Not set"}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-[#64748B]">Fuel</p>
              <p className="mt-1 font-medium text-[#102A56] text-xs sm:text-sm">
                {vehicle.fuel || "Not set"}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-[#64748B]">Body</p>
              <p className="mt-1 font-medium text-[#102A56] text-xs sm:text-sm">
                {vehicle.body || "Not set"}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-[#64748B]">Engine</p>
              <p className="mt-1 font-medium text-[#102A56] text-xs sm:text-sm">
                {vehicle.engine || "Not set"}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-[#64748B]">Drivetrain</p>
              <p className="mt-1 font-medium text-[#102A56] text-xs sm:text-sm">
                {vehicle.drivetrain || "Not set"}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-[#64748B]">Location</p>
              <p className="mt-1 font-medium text-[#102A56] text-xs sm:text-sm">
                {vehicle.location || "Not set"}
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-[#DCE8F5] pt-4">
            <h2 className="text-xs sm:text-sm font-semibold text-[#102A56]">
              Description
            </h2>

            <p className="mt-2 whitespace-pre-wrap text-xs sm:text-sm leading-5 sm:leading-6 text-[#1E3A5F]">
              {vehicle.description || "No description available."}
            </p>
          </div>

          {!vehicle.vin && (
            <div className="mt-6 rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] p-4">
              <p className="text-xs sm:text-sm font-medium text-[#102A56]">
                VIN required for vehicle history
              </p>

              <p className="mt-1 text-xs sm:text-sm text-[#1E3A5F]">
                Once the VIN is available, this vehicle can continue through the
                history, AI analysis, and customer report workflow.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
