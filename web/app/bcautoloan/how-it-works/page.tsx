import { Header } from "@/components/bcautoloan/Header";
import { Footer } from "@/components/bcautoloan/Footer";
import Link from "next/link";
import type { Metadata } from "next";

const domain = process.env.NEXT_PUBLIC_BCAUTOLOAN_DOMAIN;

export const metadata: Metadata = {
  title: "How It Works - BCAutoLoan",
  description: "Learn how our simple approval process works.",
  ...(domain && {
    alternates: {
      canonical: `${domain}/bcautoloan/how-it-works`,
    },
  }),
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bc-section">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-bc-text-primary mb-8">
            How It Works
          </h1>

          <div className="space-y-8">
            <div className="bc-card p-8">
              <div className="flex items-start space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bc-primary flex-shrink-0">
                  <span className="text-xl font-bold text-white">1</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-bc-text-primary mb-2">
                    Complete Your Application
                  </h2>
                  <p className="text-bc-text-secondary">
                    Fill out our simple online approval form. The process takes just a few minutes and requires basic personal, employment, and vehicle information.
                  </p>
                </div>
              </div>
            </div>

            <div className="bc-card p-8">
              <div className="flex items-start space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bc-primary flex-shrink-0">
                  <span className="text-xl font-bold text-white">2</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-bc-text-primary mb-2">
                    Review & Processing
                  </h2>
                  <p className="text-bc-text-secondary">
                    Our team reviews your application and follows up with you about the next steps. We keep the process clear and straightforward so you know what to expect.
                  </p>
                </div>
              </div>
            </div>

            <div className="bc-card p-8">
              <div className="flex items-start space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bc-primary flex-shrink-0">
                  <span className="text-xl font-bold text-white">3</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-bc-text-primary mb-2">
                    Get Approved
                  </h2>
                  <p className="text-bc-text-secondary">
                    Once your application has been reviewed, you can move forward with confidence and explore vehicle options with support from the BCAutoLoan team.
                  </p>
                </div>
              </div>
            </div>

            <div className="bc-card p-8">
              <div className="flex items-start space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bc-accent flex-shrink-0">
                  <span className="text-xl font-bold text-white">4</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-bc-text-primary mb-2">
                    Drive Away in Your New Vehicle
                  </h2>
                  <p className="text-bc-text-secondary">
                    Complete the final paperwork and drive away in your new vehicle. Our team is here to help you through every step of the process.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/bcautoloan/getapproved" className="bc-button-primary">
              Start Your Application
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

