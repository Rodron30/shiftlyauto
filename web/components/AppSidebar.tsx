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
      <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
        {title}
      </p>

      <ul className="mt-2 space-y-0.5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const ItemIcon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={closeMobile}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "bg-white/[0.07] font-medium text-white"
                    : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100"
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-amber-400 transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />

                <ItemIcon
                  className={`h-[16px] w-[16px] shrink-0 ${
                    active
                      ? "text-amber-400"
                      : "text-neutral-500 group-hover:text-neutral-300"
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
    <div className="flex h-full flex-col bg-neutral-950 text-neutral-200">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <Link
          href="/"
          onClick={closeMobile}
          className="flex min-w-0 items-center gap-3"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/[0.06] text-xs font-semibold tracking-tight text-white">
            SA
          </span>

          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight text-white">
              Shiftly Auto
            </span>

            <span className="block truncate text-[10px] uppercase tracking-[0.14em] text-neutral-500">
              Vehicle Intelligence
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {renderSection("Main", mainNav)}
        {profile?.role !== "customer" && renderSection("Management", managementNav)}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-2 rounded-md px-2 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-xs font-semibold text-neutral-200">
            {initialsFor(userLabel)}
          </span>

          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">
              {dealershipName ?? "---"}
            </p>

            <p className="truncate text-[10px] capitalize text-neutral-500">
              {userLabel}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-neutral-400 transition-colors hover:bg-white/[0.04] hover:text-neutral-100 disabled:opacity-50"
        >
          <LogoutIcon className="h-[16px] w-[16px] shrink-0" />
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
            className="absolute inset-0 h-full w-full bg-black/60"
          />

          <div className="absolute inset-y-0 left-0 w-60 max-w-[85vw] border-r border-white/10 shadow-2xl">
            <button
              type="button"
              onClick={closeMobile}
              aria-label="Close navigation"
              className="absolute right-3 top-4 z-10 rounded-md p-2 text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>

            {sidebarContent}
          </div>
        </div>
      ) : null}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-white/10 lg:block">
        {sidebarContent}
      </aside>
    </>
  );
}
