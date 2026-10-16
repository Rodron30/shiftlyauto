import { Header } from "@/components/bcautoloan/Header";
import { Footer } from "@/components/bcautoloan/Footer";
import type { Metadata } from "next";

const domain = process.env.NEXT_PUBLIC_BCAUTOLOAN_DOMAIN;

export const metadata: Metadata = {
  title: "Terms of Service - BCAutoLoan",
  description: "BCAutoLoan terms of service and usage agreements.",
  ...(domain && {
    alternates: {
      canonical: `${domain}/bcautoloan/terms`,
    },
  }),
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bc-section">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-bc-text-primary mb-8">
            Terms of Service
          </h1>

          <div className="bc-card p-8 space-y-6">
            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Acceptance of Terms
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                By accessing or using BCAutoLoan services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Services
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                BCAutoLoan provides approval application and vehicle selling submission services. We help customers take the next step in the vehicle-buying process and connect their requests with the appropriate systems and partners.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                User Responsibilities
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                You agree to provide accurate, complete, and current information when using our services. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Accuracy of Information
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                While we strive to provide accurate information, we do not guarantee the completeness, accuracy, or reliability of any information on our website. Approval decisions are made by our partner financial institutions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Limitation of Liability
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                BCAutoLoan shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our services. Our liability is limited to the maximum extent permitted by law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Intellectual Property
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                All content on this website, including text, graphics, logos, and software, is the property of BCAutoLoan or its licensors and is protected by copyright and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Third-Party Links
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                Our website may contain links to third-party websites. We are not responsible for the content or practices of these third-party sites. We encourage you to review the privacy policies of any third-party sites you visit.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Termination
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                We reserve the right to terminate or suspend your access to our services at any time, with or without cause, with or without notice.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Governing Law
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                These terms shall be governed by and construed in accordance with the laws of Canada. Any disputes arising under these terms shall be subject to the exclusive jurisdiction of the Canadian courts.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-bc-text-primary mb-3">
                Changes to Terms
              </h2>
              <p className="text-bc-text-secondary leading-relaxed">
                We may modify these terms at any time. We will notify users of material changes by posting the updated terms on this website. Your continued use of our services after such changes constitutes acceptance of the new terms.
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

