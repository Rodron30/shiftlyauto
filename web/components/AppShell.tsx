"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/auth",
  "/reset-password",
  "/report",
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isPublic = PUBLIC_PREFIXES.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <>
      <AppSidebar />

      <main className="min-h-screen bg-neutral-50 lg:pl-60">
        {children}
      </main>
    </>
  );
}
