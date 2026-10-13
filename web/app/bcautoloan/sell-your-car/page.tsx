"use client";

import Image from "next/image";
import { useState } from "react";
import { Header } from "@/components/bcautoloan/Header";
import { Footer } from "@/components/bcautoloan/Footer";
import { SellCarForm } from "@/components/bcautoloan/SellCarForm";

type VehicleLookup = {
  vin: string;
  postalCode: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  bodyClass: string;
  fuelType: string;
  driveType: string;
  transmission: string;
  engine: string;
};

const comparisonItems = [
  {
    title: "Online vehicle start",
    bcautoloan:
      "Get started online with your VIN and postal code before moving to the next step.",
    privateSale:
      "Create listings, respond to buyers, arrange viewings, and manage inquiries yourself.",
  },
  {
    title: "Clearer next steps",
    bcautoloan:
      "Review your vehicle information and work with the BCAutoLoan team through the process.",
    privateSale:
      "Buyers may negotiate heavily or make offers that do not meet your expectations.",
  },
  {
    title: "Less hassle",
    bcautoloan:
      "Avoid the work involved in creating and managing a private vehicle listing.",
    privateSale:
      "You may need to coordinate multiple meetings, messages, viewings, and payment arrangements.",
  },
  {
    title: "Supported process",
    bcautoloan:
      "Keep the process organized from your initial vehicle details through the next steps.",
    privateSale:
      "You are responsible for coordinating the sale, paperwork, payment, and buyer communication.",
  },
];

const steps = [
  {
    number: "1",
    title: "Tell Us About Your Car",
    description:
      "Start with your VIN and postal code, then provide the vehicle details needed to prepare your offer.",
  },
  {
    number: "2",
    title: "Review Your Offer",
    description:
      "We review your vehicle information and follow up if additional details are needed to assess the offer.",
  },
  {
    number: "3",
    title: "Complete the Next Step",
    description:
      "If you are happy with the offer, our team will guide you through the next steps for completing the sale.",
  },
];

const faqs = [
  {
    question: "How do I sell my car to BCAutoLoan?",
    answer:
      "Start online with your VIN and postal code. We identify your vehicle, collect the details needed for the appraisal, and guide you through the next steps.",
  },
  {
    question: "How is the value of my car determined?",
    answer:
      "The offer is based on your vehicle information and available comparable dealer inventory. Vehicle details such as model year, make, model, mileage, and condition can affect the estimated value.",
  },
  {
    question: "Can my offer change?",
    answer:
      "An initial online offer is based on the information available at the time. Additional vehicle details or verification may affect the final amount.",
  },
  {
    question: "Can I sell my car if I still owe money on it?",
    answer:
      "You can still start the process. If there is an existing loan or lien on the vehicle, our team can help explain the information needed for the next steps.",
  },
  {
    question: "How do I get paid?",
    answer:
      "Payment arrangements are discussed as part of the final vehicle sale process. Our team will provide the applicable next steps once your offer and vehicle details have been reviewed.",
  },
  {
    question: "Where do I complete the vehicle handoff?",
    answer:
      "The BCAutoLoan team will provide the applicable handoff instructions and location details as you move through the completed sale process.",
  },
];

export default function SellYourCarPage() {
  const [vin, setVin] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [vehicle, setVehicle] = useState<VehicleLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLookup = async (event: React.FormEvent) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/bcautoloan/sell-car/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vin,
          postalCode,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "We couldn't verify this vehicle."
        );
      }

      setVehicle(result.vehicle);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't verify this vehicle."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 bg-white">
        {/* SELL YOUR CAR HERO */}
        <section className="bc-section">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
              <div className="max-w-2xl">

                <h1 className="text-4xl font-bold tracking-tight text-bc-text-primary sm:text-5xl lg:text-6xl">
                  The <span className="text-blue-600">Easiest Way to Sell</span> Your Car in Canada.
                </h1>

                <p className="mt-6 max-w-xl text-lg leading-8 text-bc-text-secondary">
                  Skip the hassle of selling your car privately. Get your
                  online offer and take the next step with BCAutoLoan.
                </p>
              </div>

              <div className="w-full max-w-xl justify-self-end">
                <div className="bc-card p-6 sm:p-8">
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-bc-text-primary sm:text-3xl">
                      Start with your vehicle
                    </h2>

                    <p className="mt-3 text-bc-text-secondary">
                      Enter your VIN to get started with your offer.
                    </p>
                  </div>

                  <form onSubmit={handleLookup} className="space-y-5">
                    <div>
                      <label className="bc-label" htmlFor="vin">
                        VIN
                      </label>

                      <input
                        id="vin"
                        type="text"
                        value={vin}
                        onChange={(event) =>
                          setVin(
                            event.target.value
                              .toUpperCase()
                              .replace(/\s/g, "")
                              .slice(0, 17)
                          )
                        }
                        className="bc-input w-full uppercase tracking-wide"
                        placeholder="Enter your 17-character VIN"
                        maxLength={17}
                        autoComplete="off"
                        required
                      />

                      <p className="mt-2 text-sm text-bc-text-secondary">
                        Your VIN is usually found on the driver&apos;s side
                        dashboard or inside the driver&apos;s door frame.
                      </p>

                      <a
                        href="#vin-help"
                        className="mt-2 inline-block text-sm font-medium text-bc-primary hover:underline"
                      >
                        Where can I find your VIN?
                      </a>
                    </div>

                    <div>
                      <label className="bc-label" htmlFor="postalCode">
                        Postal Code
                      </label>

                      <input
                        id="postalCode"
                        type="text"
                        value={postalCode}
                        onChange={(event) =>
                          setPostalCode(
                            event.target.value.toUpperCase().slice(0, 7)
                          )
                        }
                        className="bc-input w-full uppercase"
                        placeholder="A1A 1A1"
                        maxLength={7}
                        autoComplete="postal-code"
                        required
                      />

                      <p className="mt-2 text-sm text-bc-text-secondary">
                        We use your postal code to help assess your vehicle
                        against the current local market.
                      </p>
                    </div>

                    {error && (
                      <div
                        role="alert"
                        className="rounded-lg border border-bc-danger bg-bc-danger-light p-4"
                      >
                        <p className="text-sm text-bc-danger">{error}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="bc-button-primary w-full"
                      disabled={loading}
                    >
                      {loading ? "Checking Vehicle..." : "Get My Offer"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* VERIFIED VEHICLE / OFFER */}
        {vehicle && (
          <section className="bc-section pt-0">
            <div className="mx-auto max-w-5xl">
              <div className="text-center mb-10">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-bc-text-secondary mb-3">
                  Vehicle verified
                </p>

                <h2 className="text-3xl sm:text-4xl font-bold text-bc-text-primary">
                  Tell us a little more about your vehicle
                </h2>

                <p className="mt-4 text-lg text-bc-text-secondary max-w-2xl mx-auto">
                  We&apos;ve identified your vehicle. Complete the remaining
                  details so our team can prepare your offer.
                </p>
              </div>

              <div className="bc-card p-6 mb-8">
                <div className="flex flex-col sm:flex-row gap-6 items-center">
                  <div className="relative w-full sm:w-56 aspect-[4/3] bg-white rounded-xl overflow-hidden">
                    <Image
                      src="/images/bcautoloan/car.png"
                      alt="Vehicle"
                      fill
                      className="object-contain p-4"
                    />
                  </div>

                  <div className="flex-1">
                    <p className="text-sm text-bc-text-secondary">
                      Vehicle
                    </p>

                    <h3 className="text-2xl font-bold text-bc-text-primary">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h3>

                    {vehicle.trim && (
                      <p className="mt-1 text-bc-text-secondary">
                        {vehicle.trim}
                      </p>
                    )}

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      {vehicle.bodyClass && (
                        <div>
                          <span className="block text-bc-text-muted">
                            Type
                          </span>
                          <span className="font-medium text-bc-text-primary">
                            {vehicle.bodyClass}
                          </span>
                        </div>
                      )}

                      {vehicle.fuelType && (
                        <div>
                          <span className="block text-bc-text-muted">
                            Fuel
                          </span>
                          <span className="font-medium text-bc-text-primary">
                            {vehicle.fuelType}
                          </span>
                        </div>
                      )}

                      {vehicle.driveType && (
                        <div>
                          <span className="block text-bc-text-muted">
                            Drive
                          </span>
                          <span className="font-medium text-bc-text-primary">
                            {vehicle.driveType}
                          </span>
                        </div>
                      )}

                      {vehicle.transmission && (
                        <div>
                          <span className="block text-bc-text-muted">
                            Transmission
                          </span>
                          <span className="font-medium text-bc-text-primary">
                            {vehicle.transmission}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <SellCarForm
                initialVehicle={{
                  vin: vehicle.vin,
                  postalCode: vehicle.postalCode,
                  year: vehicle.year,
                  make: vehicle.make,
                  model: vehicle.model,
                  trim: vehicle.trim,
                  mileage: "",
                  condition: "",
                  ownershipStatus: "",
                  vehicleLocation: vehicle.postalCode,
                }}
              />
            </div>
          </section>
        )}

        {/* PRIVATE SALE COMPARISON */}
        <section className="bc-section bg-bc-surface">
          <div className="mx-auto max-w-7xl">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-bc-text-secondary mb-4">
                Sell with confidence
              </p>

              <h2 className="text-3xl sm:text-4xl font-bold text-bc-text-primary">
                A Safe &amp; Convenient Alternative to Selling Your Car
                Privately
              </h2>

              <p className="mt-4 text-lg text-bc-text-secondary">
                Start online with BCAutoLoan and avoid the work and uncertainty
                that can come with a private sale.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {comparisonItems.map((item) => (
                <div key={item.title} className="bc-card p-6 sm:p-8">
                  <h3 className="text-xl font-bold text-bc-text-primary">
                    {item.title}
                  </h3>

                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <div>
                      <p className="text-sm font-semibold text-bc-primary">
                        BCAutoLoan
                      </p>

                      <p className="mt-2 text-sm leading-6 text-bc-text-secondary">
                        {item.bcautoloan}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-bc-text-secondary">
                        Private Sale
                      </p>

                      <p className="mt-2 text-sm leading-6 text-bc-text-secondary">
                        {item.privateSale}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="bc-section">
          <div className="mx-auto max-w-7xl">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-bc-text-secondary mb-4">
                How It Works
              </p>

              <h2 className="text-3xl sm:text-4xl font-bold text-bc-text-primary">
                Selling your car can be simple.
              </h2>

              <p className="mt-4 text-lg text-bc-text-secondary">
                Get started online and follow three straightforward steps.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.number} className="bc-card p-6 sm:p-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bc-surface text-lg font-bold text-bc-text-primary">
                    {step.number}
                  </div>

                  <h3 className="mt-6 text-xl font-bold text-bc-text-primary">
                    {step.title}
                  </h3>

                  <p className="mt-3 leading-7 text-bc-text-secondary">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bc-section bg-bc-surface">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-10">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-bc-text-secondary mb-4">
                Frequently Asked Questions
              </p>

              <h2 className="text-3xl sm:text-4xl font-bold text-bc-text-primary">
                Questions about selling your car?
              </h2>
            </div>

            <div className="space-y-4">
              {faqs.map((faq) => (
                <div
                  key={faq.question}
                  className="bc-card group overflow-hidden"
                >
                  <div className="cursor-default p-5 sm:p-6 font-semibold text-bc-text-primary">
                    <div className="flex items-center justify-between gap-4">
                      <span>{faq.question}</span>

                      <span className="text-bc-text-secondary transition-transform duration-300 group-hover:rotate-45">
                        +
                      </span>
                    </div>

                    <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-300 group-hover:mt-4 group-hover:grid-rows-[1fr] group-hover:opacity-100">
                      <div className="overflow-hidden">
                        <p className="leading-7 font-normal text-bc-text-secondary">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="bc-section">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-bc-text-primary">
              The <span className="text-blue-600">Easiest Way to Sell</span> Your Car in Canada.
            </h2>

            <p className="mt-4 mx-auto max-w-2xl text-lg leading-8 text-bc-text-secondary">
              Start online with your VIN and postal code and take the next
              step with BCAutoLoan.
            </p>

            <div className="mt-8">
              <a href="#vin" className="bc-button-primary">
                Get My Offer
              </a>
            </div>
          </div>
        </section>

        <div id="vin-help" className="sr-only">
          Your VIN is usually found on the driver&apos;s side dashboard or
          inside the driver&apos;s door frame.
        </div>
      </main>

      <Footer />
    </div>
  );
}




