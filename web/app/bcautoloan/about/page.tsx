import { Header } from "@/components/bcautoloan/Header";
import { Footer } from "@/components/bcautoloan/Footer";
import type { Metadata } from "next";

const domain = process.env.NEXT_PUBLIC_BCAUTOLOAN_DOMAIN;

export const metadata: Metadata = {
  title: "About BCAutoLoan",
  description: "Learn about BCAutoLoan and our commitment to a simple, straightforward vehicle-buying experience.",
  ...(domain && {
    alternates: {
      canonical: `${domain}/bcautoloan/about`,
    },
  }),
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bc-section">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-bc-text-primary mb-8">
            About BCAutoLoan
          </h1>

          <div className="bc-card p-8 mb-8">
            <p className="text-bc-text-secondary text-lg leading-relaxed mb-6">
              BCAutoLoan is dedicated to making the vehicle-buying process simple, accessible, and straightforward for Canadians. We help customers take the next step toward finding the right vehicle with a clear and convenient experience.
            </p>
            <p className="text-bc-text-secondary text-lg leading-relaxed mb-6">
              Our mission is to provide a transparent, straightforward experience that puts customers first. We believe finding and purchasing a vehicle should be clear, convenient, and supported from start to finish.
            </p>
            <p className="text-bc-text-secondary text-lg leading-relaxed">
              Whether you&apos;re looking for your first car, upgrading to a family vehicle, or finding something more fuel-efficient, BCAutoLoan is here to help you move through the vehicle-buying process with confidence.
            </p>
          </div>

          <div className="bc-card p-8">
            <h2 className="text-2xl font-semibold text-bc-text-primary mb-4">
              Our Commitment
            </h2>
            <ul className="space-y-3 text-bc-text-secondary">
              <li className="flex items-start">
                <span className="text-bc-primary mr-2">&#10003;</span>
                <span>Simple, transparent application process</span>
              </li>
              <li className="flex items-start">
                <span className="text-bc-primary mr-2">&#10003;</span>
                <span>Secure handling of your personal information</span>
              </li>
              <li className="flex items-start">
                <span className="text-bc-primary mr-2">&#10003;</span>
                <span>Partnerships with trusted financial institutions</span>
              </li>
              <li className="flex items-start">
                <span className="text-bc-primary mr-2">&#10003;</span>
                <span>Responsive customer support</span>
              </li>
              <li className="flex items-start">
                <span className="text-bc-primary mr-2">&#10003;</span>
                <span>Fast application processing</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}


