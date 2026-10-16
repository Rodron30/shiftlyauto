import { Header } from "@/components/bcautoloan/Header";
import { Footer } from "@/components/bcautoloan/Footer";
import type { Metadata } from "next";

const domain = process.env.NEXT_PUBLIC_BCAUTOLOAN_DOMAIN;

export const metadata: Metadata = {
  title: "Privacy Policy - BCAutoLoan",
  description: "BCAutoLoan privacy policy and data handling practices.",
  ...(domain && {
    alternates: {
      canonical: `${domain}/bcautoloan/privacy`,
    },
  }),
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bc-section">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-bc-text-primary mb-8">
            Privacy Policy
          </h1>

          <div className="bc-card p-8 space-y-6">
            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Information We Collect
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                We collect information you provide directly to us when you complete an application, including personal information, contact details, employment information, and vehicle preferences. We also collect technical information about your device and usage of our website.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                How We Use Your Information
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                We use the information you provide to process your approval application, communicate with you about your application, and coordinate the next steps related to your request. We may also use your information to improve our services and comply with legal obligations.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Information Sharing
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                We may share the information you provide with the systems and service providers needed to process and manage your request, including the systems used by BCAutoLoan to manage applications and customer inquiries. We do not sell your personal information to third parties for marketing purposes. We may also share information when required by law or to protect our rights.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Data Security
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                We implement industry-standard security measures to protect your personal information. This includes encryption, secure servers, and access controls. However, no method of transmission over the internet is completely secure.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Your Rights
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                You have the right to access, correct, or delete your personal information. You may also opt out of certain communications. To exercise these rights, please contact us using the information provided on our Contact page.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Changes to This Policy
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the &quot;Last Updated&quot; date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Contact Us
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                If you have questions about this privacy policy or our data practices, please contact us through our Contact page.
              </p>
            </section>

            <p className="text-sm text-bc-text-muted pt-4 border-t border-bc-border">
              Last Updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}


