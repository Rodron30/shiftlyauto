"use client";

import { useState } from "react";
import {
  SellCarFormData,
  VEHICLE_CONDITIONS,
  OWNERSHIP_STATUSES,
  CONTACT_METHODS,
} from "@/lib/bcautoloan/validation/schemas";
import {
  validateSellCarForm,
  sanitizeSellCarData,
  ValidationError,
} from "@/lib/bcautoloan/validation/validators";

type InitialVehicle = {
  vin: string;
  postalCode: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  mileage: string;
  condition: string;
  ownershipStatus: string;
  vehicleLocation: string;
};

type OfferResult = {
  vehicle?: {
    year?: number | null;
    make?: string;
    model?: string;
    trim?: string;
    body?: string;
    engine?: string;
    drivetrain?: string;
    fuel?: string;
  };
  valuation?: {
    offer: number;
    marketValue: number;
    comparableCount: number;
    source: string;
    postalCode: string;
  };
};

type SellCarFormProps = {
  initialVehicle: InitialVehicle;
};

export function SellCarForm({ initialVehicle }: SellCarFormProps) {
  const [formData, setFormData] = useState<Partial<SellCarFormData>>({
    year: initialVehicle.year,
    make: initialVehicle.make,
    model: initialVehicle.model,
    trim: initialVehicle.trim,
    mileage: initialVehicle.mileage,
    condition: initialVehicle.condition,
    ownershipStatus: initialVehicle.ownershipStatus,
    vehicleLocation: initialVehicle.vehicleLocation || initialVehicle.postalCode,
  });

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingOffer, setIsGettingOffer] = useState(false);
  const [offerResult, setOfferResult] = useState<OfferResult | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);

  const updateField = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => prev.filter((error) => error.field !== name));
  };

  const getErrorForField = (fieldName: string): string | undefined => {
    return errors.find((error) => error.field === fieldName)?.message;
  };

  const handleMileageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const digits = event.target.value.replace(/\D/g, "");
    updateField("mileage", digits);
  };

  const handleOffer = async (event: React.FormEvent) => {
    event.preventDefault();

    setErrors([]);

    if (!formData.mileage) {
      setErrors([
        {
          field: "mileage",
          message: "Please enter your vehicle mileage.",
        },
      ]);
      return;
    }

    if (!formData.condition) {
      setErrors([
        {
          field: "condition",
          message: "Please select your vehicle condition.",
        },
      ]);
      return;
    }

    setIsGettingOffer(true);

    try {
      const response = await fetch("/api/bcautoloan/sell-car/offer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vin: initialVehicle.vin,
          postalCode: initialVehicle.postalCode,
          mileage: formData.mileage,
          condition: formData.condition,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "We couldn't calculate an offer for this vehicle right now."
        );
      }

      setOfferResult(result);
    } catch (error) {
      console.error("Sell car offer error:", error);

      setErrors([
        {
          field: "submit",
          message:
            error instanceof Error
              ? error.message
              : "Unable to calculate an offer right now.",
        },
      ]);
    } finally {
      setIsGettingOffer(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationErrors = validateSellCarForm(formData);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors([]);

    try {
      const notes = [
        `VIN: ${initialVehicle.vin}`,
        `Postal Code: ${initialVehicle.postalCode}`,
        offerResult?.valuation
          ? `Estimated Offer: CAD $${offerResult.valuation.offer.toLocaleString(
              "en-CA",
              {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }
            )}`
          : "",
        offerResult?.valuation
          ? `Comparable Market Value: CAD $${offerResult.valuation.marketValue.toLocaleString(
              "en-CA",
              {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }
            )}`
          : "",
        offerResult?.valuation
          ? `Comparable Vehicles: ${offerResult.valuation.comparableCount}`
          : "",
        "Source: BCAutoLoan comparable dealer inventory",
      ]
        .filter(Boolean)
        .join("\n");

      const submissionData: SellCarFormData = {
        firstName: String(formData.firstName || ""),
        lastName: String(formData.lastName || ""),
        phone: String(formData.phone || ""),
        email: String(formData.email || ""),
        year: String(formData.year || initialVehicle.year || ""),
        make: String(formData.make || initialVehicle.make || ""),
        model: String(formData.model || initialVehicle.model || ""),
        trim: String(formData.trim || initialVehicle.trim || ""),
        mileage: String(formData.mileage || ""),
        condition: String(formData.condition || ""),
        ownershipStatus: String(formData.ownershipStatus || ""),
        vehicleLocation: String(
          formData.vehicleLocation || initialVehicle.postalCode || ""
        ),
        notes,
        preferredContactMethod: String(
          formData.preferredContactMethod || ""
        ),
        honeypot: "",
      };

      const sanitizedData = sanitizeSellCarData(submissionData);

      const response = await fetch("/api/bcautoloan/sell-car", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sanitizedData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Submission failed.");
      }

      setReferenceNumber(result.referenceNumber || null);
      setSubmitSuccess(true);
    } catch (error) {
      console.error("Sell car CRM submission error:", error);

      setErrors([
        {
          field: "submit",
          message:
            error instanceof Error
              ? error.message
              : "Failed to submit your information. Please try again.",
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="bc-card p-8 text-center">
        <div className="mb-4 text-5xl text-bc-success">&#10003;</div>

        <h2 className="mb-4 text-3xl font-bold text-bc-text-primary">
          Thanks — we received your vehicle details
        </h2>

        <p className="mb-6 text-bc-text-secondary">
          Our team will review your information and follow up with you about
          the next steps for your vehicle offer.
        </p>

        {referenceNumber && (
          <div className="bc-card mb-6 bg-bc-surface-light p-4">
            <p className="mb-1 text-sm text-bc-text-tertiary">
              Reference Number
            </p>
            <p className="text-xl font-semibold text-bc-text-primary">
              {referenceNumber}
            </p>
          </div>
        )}

        <p className="text-sm text-bc-text-muted">
          We&apos;ll contact you at {formData.email}.
        </p>
      </div>
    );
  }

  if (offerResult?.valuation) {
    const offer = offerResult.valuation.offer;

    return (
      <div className="space-y-6">
        <div className="bc-card p-6 sm:p-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-bc-text-secondary">
              Your estimated offer
            </p>

            <div className="mt-4 text-5xl font-bold tracking-tight text-bc-text-primary">
              CAD $
              {offer.toLocaleString("en-CA", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-bc-text-secondary">
              This estimate is based on comparable vehicles in our current
              dealer inventory and the vehicle information you provided.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-bc-surface-light p-4">
              <p className="text-xs text-bc-text-muted">Market value</p>
              <p className="mt-1 font-semibold text-bc-text-primary">
                CAD $
                {offerResult.valuation.marketValue.toLocaleString("en-CA", {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>

            <div className="rounded-xl bg-bc-surface-light p-4">
              <p className="text-xs text-bc-text-muted">Comparable vehicles</p>
              <p className="mt-1 font-semibold text-bc-text-primary">
                {offerResult.valuation.comparableCount}
              </p>
            </div>

            <div className="col-span-2 rounded-xl bg-bc-surface-light p-4 sm:col-span-1">
              <p className="text-xs text-bc-text-muted">Vehicle</p>
              <p className="mt-1 font-semibold text-bc-text-primary">
                {initialVehicle.year} {initialVehicle.make}{" "}
                {initialVehicle.model}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bc-card p-6 sm:p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-bc-text-primary">
              Continue with your offer
            </h2>

            <p className="mt-2 text-bc-text-secondary">
              Leave your contact details and our team can follow up with you.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="bc-label" htmlFor="firstName">
                First Name *
              </label>
              <input
                id="firstName"
                type="text"
                value={formData.firstName || ""}
                onChange={(event) =>
                  updateField("firstName", event.target.value)
                }
                className={`bc-input w-full ${
                  getErrorForField("firstName")
                    ? "border-bc-danger"
                    : ""
                }`}
                placeholder="John"
              />
              {getErrorForField("firstName") && (
                <p className="mt-1 text-sm text-bc-danger">
                  {getErrorForField("firstName")}
                </p>
              )}
            </div>

            <div>
              <label className="bc-label" htmlFor="lastName">
                Last Name *
              </label>
              <input
                id="lastName"
                type="text"
                value={formData.lastName || ""}
                onChange={(event) =>
                  updateField("lastName", event.target.value)
                }
                className={`bc-input w-full ${
                  getErrorForField("lastName")
                    ? "border-bc-danger"
                    : ""
                }`}
                placeholder="Doe"
              />
              {getErrorForField("lastName") && (
                <p className="mt-1 text-sm text-bc-danger">
                  {getErrorForField("lastName")}
                </p>
              )}
            </div>

            <div>
              <label className="bc-label" htmlFor="phone">
                Phone *
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone || ""}
                onChange={(event) =>
                  updateField("phone", event.target.value)
                }
                className={`bc-input w-full ${
                  getErrorForField("phone")
                    ? "border-bc-danger"
                    : ""
                }`}
                placeholder="(604) 555-1234"
              />
              {getErrorForField("phone") && (
                <p className="mt-1 text-sm text-bc-danger">
                  {getErrorForField("phone")}
                </p>
              )}
            </div>

            <div>
              <label className="bc-label" htmlFor="email">
                Email *
              </label>
              <input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(event) =>
                  updateField("email", event.target.value)
                }
                className={`bc-input w-full ${
                  getErrorForField("email")
                    ? "border-bc-danger"
                    : ""
                }`}
                placeholder="john@example.com"
              />
              {getErrorForField("email") && (
                <p className="mt-1 text-sm text-bc-danger">
                  {getErrorForField("email")}
                </p>
              )}
            </div>

            <div>
              <label className="bc-label" htmlFor="ownershipStatus">
                Ownership Status *
              </label>
              <select
                id="ownershipStatus"
                value={formData.ownershipStatus || ""}
                onChange={(event) =>
                  updateField("ownershipStatus", event.target.value)
                }
                className={`bc-input w-full ${
                  getErrorForField("ownershipStatus")
                    ? "border-bc-danger"
                    : ""
                }`}
              >
                <option value="">Select Status</option>
                {OWNERSHIP_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              {getErrorForField("ownershipStatus") && (
                <p className="mt-1 text-sm text-bc-danger">
                  {getErrorForField("ownershipStatus")}
                </p>
              )}
            </div>

            <div>
              <label className="bc-label" htmlFor="preferredContactMethod">
                Preferred Contact *
              </label>
              <select
                id="preferredContactMethod"
                value={formData.preferredContactMethod || ""}
                onChange={(event) =>
                  updateField(
                    "preferredContactMethod",
                    event.target.value
                  )
                }
                className={`bc-input w-full ${
                  getErrorForField("preferredContactMethod")
                    ? "border-bc-danger"
                    : ""
                }`}
              >
                <option value="">Select Method</option>
                {CONTACT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              {getErrorForField("preferredContactMethod") && (
                <p className="mt-1 text-sm text-bc-danger">
                  {getErrorForField("preferredContactMethod")}
                </p>
              )}
            </div>
          </div>

          <input
            type="text"
            name="honeypot"
            value={formData.honeypot || ""}
            onChange={(event) =>
              updateField("honeypot", event.target.value)
            }
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
          />

          {getErrorForField("submit") && (
            <div className="mt-5 rounded-lg border border-bc-danger bg-bc-danger-light p-4">
              <p className="text-sm text-bc-danger">
                {getErrorForField("submit")}
              </p>
            </div>
          )}

          <button
            type="submit"
            className="bc-button-primary mt-6 w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Continue With My Offer"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={handleOffer} className="bc-card p-6 sm:p-8">
      <div className="mb-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-bc-text-primary">
          Tell us a little more about your vehicle
        </h2>

        <p className="mt-3 text-bc-text-secondary">
          We&apos;ve verified your vehicle. Add the details below so we can
          calculate your estimated offer.
        </p>
      </div>

      <div className="mb-8 rounded-xl bg-bc-surface-light p-5">
        <p className="text-sm text-bc-text-muted">Vehicle</p>
        <p className="mt-1 text-xl font-semibold text-bc-text-primary">
          {initialVehicle.year} {initialVehicle.make} {initialVehicle.model}
        </p>

        {initialVehicle.trim && (
          <p className="mt-1 text-sm text-bc-text-secondary">
            {initialVehicle.trim}
          </p>
        )}

        <p className="mt-3 text-xs uppercase tracking-wide text-bc-text-muted">
          VIN ending {initialVehicle.vin.slice(-6)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="bc-label" htmlFor="mileage">
            Mileage (KM) *
          </label>

          <input
            id="mileage"
            type="text"
            inputMode="numeric"
            value={
              formData.mileage
                ? Number(formData.mileage).toLocaleString("en-CA")
                : ""
            }
            onChange={handleMileageChange}
            className={`bc-input w-full ${
              getErrorForField("mileage")
                ? "border-bc-danger"
                : ""
            }`}
            placeholder="50,000"
          />

          {getErrorForField("mileage") && (
            <p className="mt-1 text-sm text-bc-danger">
              {getErrorForField("mileage")}
            </p>
          )}
        </div>

        <div>
          <label className="bc-label" htmlFor="condition">
            Vehicle Condition *
          </label>

          <select
            id="condition"
            value={formData.condition || ""}
            onChange={(event) =>
              updateField("condition", event.target.value)
            }
            className={`bc-input w-full ${
              getErrorForField("condition")
                ? "border-bc-danger"
                : ""
            }`}
          >
            <option value="">Select Condition</option>
            {VEHICLE_CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>
                {condition}
              </option>
            ))}
          </select>

          {getErrorForField("condition") && (
            <p className="mt-1 text-sm text-bc-danger">
              {getErrorForField("condition")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-bc-border bg-white p-4">
        <p className="text-sm leading-6 text-bc-text-secondary">
          Your estimate is based on comparable vehicles in our current dealer
          inventory. It is an estimate and may change after your vehicle
          information is reviewed.
        </p>
      </div>

      {getErrorForField("submit") && (
        <div className="mt-5 rounded-lg border border-bc-danger bg-bc-danger-light p-4">
          <p className="text-sm text-bc-danger">
            {getErrorForField("submit")}
          </p>
        </div>
      )}

      <button
        type="submit"
        className="bc-button-primary mt-6 w-full"
        disabled={isGettingOffer}
      >
        {isGettingOffer ? "Calculating Your Offer..." : "Get My Offer"}
      </button>
    </form>
  );
}
