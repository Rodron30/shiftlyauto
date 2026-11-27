import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/ui/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shiftly Auto",
  description: "Vehicle Intelligence dashboard",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const requestHeaders = await headers();
  const hostname = requestHeaders
    .get("host")
    ?.split(":")[0]
    ?.toLowerCase();

  const isBCAutoLoanDomain =
    hostname === "bcautoloan.ca" ||
    hostname === "www.bcautoloan.ca";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          {isBCAutoLoanDomain ? (
            children
          ) : (
            <AppShell>{children}</AppShell>
          )}
        </ToastProvider>
      </body>
    </html>
  );
}
