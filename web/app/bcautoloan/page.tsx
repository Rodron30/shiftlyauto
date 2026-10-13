import Image from "next/image";
import { Header } from "@/components/bcautoloan/Header";
import { Footer } from "@/components/bcautoloan/Footer";
import { Hero } from "@/components/bcautoloan/Hero";
import { HowItWorks } from "@/components/bcautoloan/HowItWorks";
import { PartnerSection } from "@/components/bcautoloan/PartnerSection";
import { ShopConfidence } from "@/components/bcautoloan/ShopConfidence";
import { WhyBCAutoLoan } from "@/components/bcautoloan/WhyBCAutoLoan";
import { FAQ } from "@/components/bcautoloan/FAQ";
import { Reviews } from "@/components/bcautoloan/Reviews";
import Link from "next/link";
import type { Metadata } from "next";

const domain = process.env.NEXT_PUBLIC_BCAUTOLOAN_DOMAIN;

export const metadata: Metadata = {
  ...(domain && {
    alternates: {
      canonical: `${domain}/bcautoloan`,
    },
  }),
};

export default function BCAutoLoanHomepage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <Hero />
        <ShopConfidence />


        <section className="bc-section">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="relative overflow-hidden rounded-3xl">
                <Image
                  src="/images/bcautoloan/sellyourcar.png"
                  alt="Sell your car to BCAutoLoan"
                  width={900}
                  height={650}
                  className="h-auto w-full object-contain"
                />
              </div>

              <div className="max-w-2xl">
                <h2 className="text-3xl font-bold tracking-tight text-bc-text-primary sm:text-4xl lg:text-5xl">
                  Sell Your Car Directly to BCAutoLoan
                </h2>

                <div className="mt-6 space-y-5">
                  <div className="flex items-start gap-4">
                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-bc-border bg-white text-sm font-bold text-blue-600 shadow-sm">
                      &gt;
                    </span>
                    <p className="text-lg leading-8 text-bc-text-secondary">
                      Skip the hassle of selling your car privately and sell your car directly to us.
                    </p>
                  </div>

                  <div className="flex items-start gap-4">
                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-bc-border bg-white text-sm font-bold text-blue-600 shadow-sm">
                      &gt;
                    </span>
                    <p className="text-lg leading-8 text-bc-text-secondary">
                      Get an online offer based on your vehicle details and current market information.
                    </p>
                  </div>

                  <div className="flex items-start gap-4">
                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-bc-border bg-white text-sm font-bold text-blue-600 shadow-sm">
                      &gt;
                    </span>
                    <p className="text-lg leading-8 text-bc-text-secondary">
                      No private listings, no wasted time, and no meeting strangers.
                    </p>
                  </div>
                </div>

                <div className="mt-8">
                  <Link
                    href="/bcautoloan/sell-your-car"
                    className="bc-button-primary"
                  >
                    Get My Offer
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <HowItWorks />
        <PartnerSection />

        <section className="bc-section bg-bc-surface">
          <div className="mx-auto max-w-7xl text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-bc-text-primary mb-4">
              Ready to Get Pre-Approved
            </h2>
            <p className="text-bc-text-secondary mb-8 max-w-2xl mx-auto">
              Start your application today and take the first step toward your
              next vehicle.
            </p>
            <Link href="/bcautoloan/pre-approved" className="bc-button-primary">
              Get Pre-Approved
            </Link>
          </div>
        </section>
        <WhyBCAutoLoan />
        <FAQ />

        <section className="bc-section bg-bc-surface">
          <div className="mx-auto max-w-7xl text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-bc-text-primary mb-4">
              Get Started Today
            </h2>
            <p className="text-bc-text-secondary mb-8 max-w-2xl mx-auto">
              Whether you&apos;re looking for your next vehicle or selling your
              current one, BCAutoLoan is here to help.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/bcautoloan/pre-approved"
                className="bc-button-primary"
              >
                Get Pre-Approved
              </Link>

              <Link
                href="/bcautoloan/sell-your-car"
                className="bc-button-secondary"
              >
                Sell Your Car
              </Link>
            </div>
          </div>
        </section>

        <Reviews />
      </main>

      <Footer />
    </div>
  );
}








