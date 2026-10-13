import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Open_Sans, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

const domain = process.env.NEXT_PUBLIC_BCAUTOLOAN_DOMAIN;

export const metadata: Metadata = {
  title: "BCAutoLoan - Get Pre-Approved",
  description:
    "A simple way to get pre-approved, connect with a local dealership, and find a vehicle that fits your needs and budget.",
  keywords:
    "BCAutoLoan, auto loan, car pre-approval, vehicle pre-approval, sell your car",
  authors: [{ name: "BCAutoLoan" }],
  icons: {
    icon: "/bcautoloan/icon.png",
    shortcut: "/bcautoloan/icon.png",
  },
  ...(domain && {
    openGraph: {
      title: "BCAutoLoan - Get Pre-Approved",
      description:
        "A simple way to get pre-approved, connect with a local dealership, and find a vehicle that fits your needs and budget.",
      type: "website",
      locale: "en_CA",
      url: `${domain}/bcautoloan`,
    },
  }),
  robots: {
    index: true,
    follow: true,
  },
};

export default function BCAutoLoanLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={`${outfit.variable} ${openSans.variable} min-h-screen antialiased`}
    >
      {children}
    </div>
  );
}
