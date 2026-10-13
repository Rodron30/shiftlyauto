import { Header } from "@/components/bcautoloan/Header";
import { Footer } from "@/components/bcautoloan/Footer";
import { PreApprovalForm } from "@/components/bcautoloan/PreApprovalForm";
import type { Metadata } from "next";

const domain = process.env.NEXT_PUBLIC_BCAUTOLOAN_DOMAIN;

export const metadata: Metadata = {
  title: "Get Pre-Approved",
  description: "Complete our simple pre-approval application and take the next step toward finding your vehicle.",
  ...(domain && {
    alternates: {
      canonical: `${domain}/bcautoloan/pre-approved`,
    },
  }),
};

export default function PreApprovedPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bc-section">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold text-bc-text-primary mb-4">
              Get Pre-Approved
            </h1>
            <p className="text-bc-text-secondary text-lg">
              Complete our simple pre-approval application to get started.
            </p>
          </div>

          <PreApprovalForm />
        </div>
      </main>

      <Footer />
    </div>
  );
}

