"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppTopbar } from "./AppTopbar";
import { CloseIcon, LogoutIcon } from "./icons";
import {
  MAIN_NAV,
  MANAGEMENT_NAV,
  PLATFORM_NAV,
  CUSTOMER_NAV,
  initialsFor,
  isActive,
  type NavItem,
} from "./navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Profile = {
  name: string | null;
  email: string | null;
  role: string;
  dealership_id: string | null;
};

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [dealershipName, setDealershipName] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("users")
        .select("name, email, role, dealership_id")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        setProfile(data);

        if (data.dealership_id) {
          const { data: dealership } = await supabase
            .from("dealerships")
            .select("name")
            .eq("id", data.dealership_id)
            .maybeSingle();

          setDealershipName(dealership?.name ?? null);
        }
      }

      const { data: platformAdmin } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      setIsPlatformAdmin(Boolean(platformAdmin));
    }

    loadProfile();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);

    const supabase = createSupabaseBrowserClient();

    await supabase.auth.signOut();

    // Clear all local state
    setProfile(null);
    setDealershipName(null);
    setIsPlatformAdmin(false);

    router.push("/login");
    router.refresh();
  };

  const managementNav = isPlatformAdmin
    ? [...MANAGEMENT_NAV, PLATFORM_NAV]
    : MANAGEMENT_NAV;

  const mainNav = profile?.role === "customer" ? CUSTOMER_NAV : MAIN_NAV;

  const userLabel =
    profile?.name || profile?.email || profile?.role || "...";

  const closeMobile = () => setMobileOpen(false);

  const renderSection = (title: string, items: NavItem[]) => (
    <div>
      <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-300">
        {title}
      </p>

      <ul className="mt-2 space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const ItemIcon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={closeMobile}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 ${
                  active
                    ? "bg-[#DCEEFF] text-[#102A56] font-semibold shadow-[inset_2px_2px_5px_rgba(55,65,81,0.16),inset_-2px_-2px_5px_rgba(255,255,255,0.18)]"
                    : "text-white/85 hover:bg-white/10 hover:text-white"
                }`}
              >
                <ItemIcon
                  className={`h-4 w-4 shrink-0 ${
                    active
                      ? "text-[#1677FF]"
                      : "text-white/60 group-hover:text-[#B9DDFF]"
                  }`}
                />

                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#4B5563] text-white shadow-[inset_-1px_0_0_rgba(255,255,255,0.08)]">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-[#374151] px-4 sm:px-5">
        <Link
          href="/"
          onClick={closeMobile}
          className="flex min-w-0 items-center gap-3"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#DCEEFF] text-xs font-bold tracking-tight text-[#1677FF] shadow-[4px_4px_10px_rgba(0,0,0,0.18),-3px_-3px_8px_rgba(255,255,255,0.08)]">
            SA
          </span>

          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight text-white">
              Shiftly Auto
            </span>

            <span className="block truncate text-[10px] text-gray-300">
              Drive Your Success
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5 sm:px-4">
        {renderSection("Main", mainNav)}
        {profile?.role !== "customer" && renderSection("Management", managementNav)}
      </nav>

      <div className="shrink-0 space-y-3 border-t border-white/10 p-3 sm:p-4">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#374151] px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DCEEFF] text-xs font-bold text-[#1677FF] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.06),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]">
            {initialsFor(userLabel)}
          </span>

          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">
              {dealershipName ?? "---"}
            </p>

            <p className="truncate text-[10px] capitalize text-gray-300">
              {userLabel}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-[#64748B] transition-colors hover:bg-[#F1F6FC] hover:text-white disabled:opacity-50"
        >
          <LogoutIcon className="h-4 w-4 shrink-0" />
          {loggingOut ? "Signing out..." : "Logout"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <AppTopbar
        userLabel={userLabel}
        roleLabel={profile?.role ?? null}
        dealershipName={dealershipName}
        loggingOut={loggingOut}
        onOpenMobileNav={() => setMobileOpen(true)}
        onLogout={handleLogout}
      />

      <div className="h-16" aria-hidden="true" />

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={closeMobile}
            className="absolute inset-0 h-full w-full bg-black/50 backdrop-blur-sm"
          />

          <div className="absolute inset-y-0 left-0 w-[20rem] max-w-[90vw] border-r border-white/10 bg-[#4B5563] shadow-2xl">
            <button
              type="button"
              onClick={closeMobile}
              aria-label="Close navigation"
              className="absolute right-4 top-4 z-10 rounded-lg p-2 text-gray-300 transition-colors hover:bg-[#E8F0FA] hover:text-white"
            >
              <CloseIcon className="h-5 w-5" />
            </button>

            {sidebarContent}
          </div>
        </div>
      ) : null}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[15rem] border-r border-white/10 bg-[#4B5563] lg:block">
        {sidebarContent}
      </aside>
    </>
  );
}
