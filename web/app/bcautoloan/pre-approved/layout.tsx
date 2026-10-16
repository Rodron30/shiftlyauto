import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../globals.css";

const domain = process.env.NEXT_PUBLIC_BCAUTOLOAN_DOMAIN;

export const metadata: Metadata = {
  title: "Get Approved - BCAutoLoan",
  description:
    "Complete the BCAutoLoan approval application and take the next step toward your vehicle.",
  ...(domain && {
    alternates: {
      canonical: `${domain}/bcautoloan/getapproved`,
    },
  }),
};

export default function PreApprovedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}

