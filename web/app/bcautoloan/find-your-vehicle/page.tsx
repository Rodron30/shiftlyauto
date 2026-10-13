import { Header } from "@/components/bcautoloan/Header";
import { Footer } from "@/components/bcautoloan/Footer";
import { FindVehicleHero } from "@/components/bcautoloan/FindVehicleHero";
import { FindVehicleSteps } from "@/components/bcautoloan/FindVehicleSteps";
import type { Metadata } from "next";

const domain = process.env.NEXT_PUBLIC_BCAUTOLOAN_DOMAIN;

export const metadata: Metadata = {
  title: "Find Your Vehicle - BCAutoLoan",
  description:
    "Find a vehicle that fits your needs and budget with BCAutoLoan.",
  ...(domain && {
    alternates: {
      canonical: `${domain}/bcautoloan/find-your-vehicle`,
    },
  }),
};

export default function FindYourVehiclePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <FindVehicleHero />
        <FindVehicleSteps />
      </main>

      <Footer />
    </div>
  );
}
