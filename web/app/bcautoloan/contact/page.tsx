import { Header } from "@/components/bcautoloan/Header";
import { Footer } from "@/components/bcautoloan/Footer";
import type { Metadata } from "next";

const domain = process.env.NEXT_PUBLIC_BCAUTOLOAN_DOMAIN;

export const metadata: Metadata = {
  title: "Contact - BCAutoLoan",
  description: "Get in touch with BCAutoLoan for support and inquiries.",
  ...(domain && {
    alternates: {
      canonical: `${domain}/bcautoloan/contact`,
    },
  }),
};

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bc-section">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-bc-text-primary mb-8">
            Contact Us
          </h1>

          <div className="bc-card p-8 mb-8">
            <p className="text-bc-text-secondary text-lg mb-6">
              Have questions about our services? We&apos;re here to help. Reach out to us and we&apos;ll get back to you as soon as possible.
            </p>

            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-bc-text-primary mb-2">
                  Email
                </h2>
                <p className="text-bc-text-secondary">
                  Bcautoloanca@gmail.com
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-bc-text-primary mb-2">
                  Phone
                </h2>
                <p className="text-bc-text-secondary">
                  604-442-9272
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-bc-text-primary mb-2">
                  Business Hours
                </h2>
                <p className="text-bc-text-secondary">
                  Monday - Friday: 9:00 AM - 8:00 PM<br />
                  Saturday: 10:00 AM - 6:00 PM<br />
                  Sunday: 10:00 AM - 5:00 PM
                </p>
              </div>
            </div>
          </div>

          <div className="bc-card p-8">
            <h2 className="text-2xl font-semibold text-bc-text-primary mb-4">
              Quick Links
            </h2>
            <div className="space-y-3">
              <a
                href="/bcautoloan/getapproved"
                className="block text-bc-accent hover:text-bc-accent-hover transition-colors"
              >
                Get Approved
              </a>
              <a
                href="/bcautoloan/sell-your-car"
                className="block text-bc-accent hover:text-bc-accent-hover transition-colors"
              >
                Sell Your Car
              </a>
              <a
                href="/bcautoloan/how-it-works"
                className="block text-bc-accent hover:text-bc-accent-hover transition-colors"
              >
                How It Works
              </a>
              <a
                href="/bcautoloan/faq"
                className="block text-bc-accent hover:text-bc-accent-hover transition-colors"
              >
                FAQ
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

