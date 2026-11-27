"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  CloseIcon,
  HelpIcon,
  LogoutIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
} from "./icons";
import { breadcrumbsFor, initialsFor } from "./navigation";
import { NotificationBell } from "./NotificationBell";

type AppTopbarProps = {
  userLabel: string;
  roleLabel: string | null;
  dealershipName: string | null;
  loggingOut: boolean;
  onOpenMobileNav: () => void;
  onLogout: () => void;
};

const SEARCH_PLACEHOLDER = "Search vehicles, customers, leads, or anything...";

export function AppTopbar({
  userLabel,
  roleLabel,
  dealershipName,
  loggingOut,
  onOpenMobileNav,
  onLogout,
}: AppTopbarProps) {
  const pathname = usePathname();
  const crumbs = breadcrumbsFor(pathname);

  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      if (!searchContainerRef.current?.contains(target)) {
        setSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  type SearchResults = {
    pages: { href: string; label: string }[];
    vehicles: { id: string; vin: string | null; year: number; make: string; model: string; trim: string | null }[];
    customers: { id: string; name: string; phone: string | null; email: string | null }[];
    leads: { id: string; customer_name: string; customer_phone: string | null; customer_email: string | null; interest_note: string | null }[];
    tradeAppraisals: { id: string; vin: string | null; year: number | null; make: string; model: string; trim: string | null; condition: string; notes: string | null; created_at: string }[];
    reports: { id: string; vehicle_id: string; customer_id: string | null; lead_id: string | null; created_at: string }[];
    activities: { id: string; activity_type: string; description: string | null; activity_at: string; customer_id: string | null; lead_id: string | null; user_id: string | null }[];
  };
  const [searchResults, setSearchResults] = useState<SearchResults>({ pages: [], vehicles: [], customers: [], leads: [], tradeAppraisals: [], reports: [], activities: [] });
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const query = searchQuery.trim();

    if (query.length < 2) {
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
        if (!response.ok) throw new Error("Search failed");
        setSearchResults(await response.json());
      } catch {
        setSearchResults({ pages: [], vehicles: [], customers: [], leads: [], tradeAppraisals: [], reports: [], activities: [] });
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleShortcut);

    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const searchField = (
    <div ref={searchContainerRef} className="relative w-full">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />

      {searchOpen && searchQuery.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-[#BFD7EE] bg-white shadow-lg">
          {searchLoading ? (
            <div className="px-4 py-3 text-sm text-[#64748B]">Searching...</div>
          ) : (
            <>
              {searchResults.pages.map((page) => (
                <Link
                  key={`page-${page.href}`}
                  href={page.href}
                  onClick={() => setSearchQuery("")}
                  className="block border-b border-[#E5EEF7] px-4 py-3 hover:bg-[#EAF5FF]"
                >
                  <div className="text-sm font-semibold text-[#102A56]">{page.label}</div>
                  <div className="text-xs text-[#64748B]">Page</div>
                </Link>
              ))}

              {searchResults.vehicles.map((vehicle) => (
                <Link
                  key={`vehicle-${vehicle.id}`}
                  href={vehicle.vin ? `/vehicles/${vehicle.vin}` : `/vehicles/id/${vehicle.id}`}
                  onClick={() => setSearchQuery("")}
                  className="block border-b border-[#E5EEF7] px-4 py-3 hover:bg-[#EAF5FF]"
                >
                  <div className="text-sm font-semibold text-[#102A56]">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </div>
                  <div className="text-xs text-[#64748B]">
                    Vehicle{vehicle.vin ? ` • ${vehicle.vin}` : ""}
                  </div>
                </Link>
              ))}

              {searchResults.customers.map((customer) => (
                <Link
                  key={`customer-${customer.id}`}
                  href="/customers"
                  onClick={() => setSearchQuery("")}
                  className="block border-b border-[#E5EEF7] px-4 py-3 hover:bg-[#EAF5FF]"
                >
                  <div className="text-sm font-semibold text-[#102A56]">{customer.name}</div>
                  <div className="text-xs text-[#64748B]">
                    Customer{customer.email ? ` • ${customer.email}` : ""}
                  </div>
                </Link>
              ))}

              {searchResults.leads.map((lead) => (
                <Link
                  key={`lead-${lead.id}`}
                  href="/leads"
                  onClick={() => setSearchQuery("")}
                  className="block border-b border-[#E5EEF7] px-4 py-3 hover:bg-[#EAF5FF]"
                >
                  <div className="text-sm font-semibold text-[#102A56]">{lead.customer_name}</div>
                  <div className="text-xs text-[#64748B]">
                    Lead{lead.customer_email ? ` • ${lead.customer_email}` : ""}
                  </div>
                </Link>
              ))}

              {searchResults.tradeAppraisals.map((appraisal) => (
                <Link
                  key={`appraisal-${appraisal.id}`}
                  href="/trade-appraisals"
                  onClick={() => setSearchQuery("")}
                  className="block border-b border-[#E5EEF7] px-4 py-3 hover:bg-[#EAF5FF]"
                >
                  <div className="text-sm font-semibold text-[#102A56]">
                    {appraisal.year ?? ""} {appraisal.make} {appraisal.model}
                  </div>
                  <div className="text-xs text-[#64748B]">
                    Trade-In{appraisal.vin ? ` • ${appraisal.vin}` : ""}
                  </div>
                </Link>
              ))}

              {searchResults.reports.map((report) => (
                <Link
                  key={`report-${report.id}`}
                  href="/reports"
                  onClick={() => setSearchQuery("")}
                  className="block border-b border-[#E5EEF7] px-4 py-3 hover:bg-[#EAF5FF]"
                >
                  <div className="text-sm font-semibold text-[#102A56]">Vehicle Report</div>
                  <div className="text-xs text-[#64748B]">
                    Report • {new Date(report.created_at).toLocaleDateString()}
                  </div>
                </Link>
              ))}

              {searchResults.activities.map((activity) => (
                <Link
                  key={`activity-${activity.id}`}
                  href="/activities"
                  onClick={() => setSearchQuery("")}
                  className="block border-b border-[#E5EEF7] px-4 py-3 hover:bg-[#EAF5FF]"
                >
                  <div className="text-sm font-semibold text-[#102A56]">
                    {activity.activity_type}
                  </div>
                  <div className="text-xs text-[#64748B]">
                    {activity.description || "Activity"}
                  </div>
                </Link>
              ))}

              {searchResults.vehicles.length > 0 && searchQuery.trim().length >= 2 && (
                <Link
                  href={`/vehicles?q=${encodeURIComponent(searchQuery.trim())}`}
                  onClick={() => {
                    setSearchQuery("");
                    setSearchOpen(false);
                  }}
                  className="sticky bottom-0 block border-t border-[#DCE8F5] bg-[#F3F8FF] px-4 py-3 text-center text-sm font-semibold text-[#1677FF] hover:bg-[#EAF5FF]"
                >
                  View all vehicle results for &quot;{searchQuery.trim()}&quot;
                </Link>
              )}

              {!searchResults.pages.length &&
              !searchResults.vehicles.length &&
              !searchResults.customers.length &&
              !searchResults.leads.length &&
              !searchResults.tradeAppraisals.length &&
              !searchResults.reports.length &&
              !searchResults.activities.length ? (
                <div className="px-4 py-3 text-sm text-[#64748B]">No results found</div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <input
        ref={searchRef}
        type="search"
        placeholder={SEARCH_PLACEHOLDER}
        aria-label={SEARCH_PLACEHOLDER}
        value={searchQuery}
        onFocus={() => setSearchOpen(true)}
        onChange={(event) => {
          setSearchQuery(event.target.value);
          setSearchOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && searchQuery.trim().length >= 2) {
            const firstPage = searchResults.pages[0];
            const firstVehicle = searchResults.vehicles[0];
            const href = firstPage?.href
              ?? (firstVehicle
                ? firstVehicle.vin
                  ? `/vehicles/${firstVehicle.vin}`
                  : `/vehicles/id/${firstVehicle.id}`
                : searchResults.customers[0]
                  ? "/customers"
                  : searchResults.leads[0]
                    ? "/leads"
                    : searchResults.tradeAppraisals[0]
                      ? "/trade-appraisals"
                      : searchResults.reports[0]
                        ? "/reports"
                        : searchResults.activities[0]
                          ? "/activities"
                          : null);

            if (href) {
              window.location.href = href;
              setSearchQuery("");
            }
          }
        }}
        className="h-9 w-full rounded-lg border border-[#BFD7EE] bg-[#EAF5FF] shadow-[inset_2px_2px_5px_rgba(71,112,150,0.08),inset_-2px_-2px_5px_rgba(255,255,255,0.8)] pl-10 pr-12 text-sm text-[#102A56] placeholder:text-[#94A3B8] outline-none transition-all duration-200 focus:border-[#1677FF] focus:bg-white focus:ring-2 focus:ring-[#1677FF]/10"
      />

      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-xl border border-[#BFD7EE] bg-[#F7FBFF] px-2 py-1 text-[10px] font-medium tracking-wide text-[#64748B] sm:block">
        Ctrl K
      </kbd>
    </div>
  );
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-[#BFD7EE] bg-[#DCEEFF] text-[#102A56] shadow-[0_4px_14px_rgba(71,112,150,0.10)] lg:left-[15rem]">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-5">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="-ml-1 rounded-lg p-1.5 text-[#6B7C93] transition-colors hover:bg-white/60 hover:text-[#102A56] lg:hidden"
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        <nav aria-label="Breadcrumb" className="min-w-0 flex-1 lg:flex-none">
          <ol className="flex items-center gap-2 text-xs">
            {crumbs.map((crumb, index) => {
              const last = index === crumbs.length - 1;

              return (
                <li
                  key={crumb.href}
                  className={`flex items-center gap-2 ${
                    last ? "min-w-0" : "hidden sm:flex"
                  }`}
                >
                  {index > 0 ? (
                    <span
                      className="hidden text-[#8B9DB3] sm:inline"
                      aria-hidden="true"
                    >
                      /
                    </span>
                  ) : null}

                  {last ? (
                    <span
                      aria-current="page"
                      className="truncate text-base font-semibold leading-6 text-[#102A56] sm:text-[17px]"
                    >
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="truncate text-[#6B7C93] transition-colors hover:text-[#1677FF]"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="mx-auto hidden w-full max-w-md md:block">
          {searchField}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setMobileSearchOpen((open) => !open)}
            aria-label="Search"
            className="rounded-lg p-1.5 text-[#6B7C93] transition-colors hover:bg-white/60 hover:text-[#102A56] md:hidden"
          >
            {mobileSearchOpen ? (
              <CloseIcon className="h-5 w-5" />
            ) : (
              <SearchIcon className="h-5 w-5" />
            )}
          </button>

          <NotificationBell />

          <button
            type="button"
            aria-label="Help"
            title="Help"
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#6B7C93] transition-colors hover:bg-white/60 hover:text-[#102A56] sm:flex"
          >
            <HelpIcon className="h-6 w-6" />
          </button>

          <div className="relative ml-0.5">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-lg border border-[#DCE8F5] bg-white py-1.5 pl-1.5 pr-2 text-left transition-colors hover:bg-white/60"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-[#1677FF] shadow-[inset_2px_2px_4px_rgba(71,112,150,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.9)]">
                {initialsFor(userLabel)}
              </span>

              <span className="hidden min-w-0 lg:block">
                <span className="block max-w-[12rem] truncate text-xs font-medium text-[#102A56]">
                  {userLabel}
                </span>

                <span className="block max-w-[12rem] truncate text-[10px] text-[#6B7C93]">
                  {dealershipName ?? "---"}
                </span>
              </span>

              <ChevronDownIcon className="h-3 w-3 shrink-0 text-[#6B7C93]" />
            </button>

            {menuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />

                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-[#BFD7EE] bg-[#F7FBFF] shadow-[0_12px_30px_rgba(71,112,150,0.16)]"
                >
                  <div className="border-b border-[#DCE8F5] px-3 py-2.5">
                    <p className="truncate text-xs font-medium text-[#102A56]">
                      {userLabel}
                    </p>

                    <p className="truncate text-[10px] capitalize text-[#6B7C93]">
                      {roleLabel ?? "---"}
                    </p>
                  </div>

                  <div className="border-b border-[#DCE8F5] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B7C93]">
                      Dealership
                    </p>

                    <p className="mt-0.5 truncate text-xs text-[#6B7C93]">
                      {dealershipName ?? "---"}
                    </p>
                  </div>

                  <div className="p-1.5">
                    <Link
                      href="/settings"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#6B7C93] transition-colors hover:bg-[#EAF5FF] hover:text-[#102A56]"
                    >
                      <SettingsIcon className="h-4 w-4" />
                      Settings
                    </Link>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={onLogout}
                      disabled={loggingOut}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#6B7C93] transition-colors hover:bg-[#EAF5FF] hover:text-[#102A56] disabled:opacity-50"
                    >
                      <LogoutIcon className="h-4 w-4" />
                      {loggingOut ? "Signing out..." : "Logout"}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {mobileSearchOpen ? (
        <div className="border-b border-[#DCE8F5] bg-white px-4 pb-3 md:hidden">
          {searchField}
        </div>
      ) : null}
    </header>
  );
}




















