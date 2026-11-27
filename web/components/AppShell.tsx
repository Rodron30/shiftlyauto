"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/auth",
  "/reset-password",
  "/report",
  "/bcautoloan",
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

      <main
        className="
          min-h-screen
          bg-[#F8FAFC]
          pt-8
          pb-20
          lg:ml-[15rem]
          lg:pb-6
        "
      >
        <div className="min-h-[calc(100vh-4rem)]">
          {children}
        </div>
      </main>

      <MobileNav />
    </>
  );
}








