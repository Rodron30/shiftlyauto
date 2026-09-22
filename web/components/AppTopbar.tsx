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

const SEARCH_PLACEHOLDER = "Search VIN, stock #, customer...";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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
    <div className="relative w-full">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />

      <input
        ref={searchRef}
        type="search"
        placeholder={SEARCH_PLACEHOLDER}
        aria-label={SEARCH_PLACEHOLDER}
        className="h-8 w-full rounded-md border border-white/10 bg-white/[0.04] pl-8 pr-16 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-amber-400/40 focus:bg-white/[0.06] focus:outline-none"
      />

      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-neutral-500 sm:block">
        Ctrl K
      </kbd>
    </div>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-white/10 bg-neutral-950 text-neutral-200 lg:left-60">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="-ml-2 rounded-md p-1.5 text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white lg:hidden"
        >
          <MenuIcon className="h-4 w-4" />
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
                      className="hidden text-neutral-700 sm:inline"
                      aria-hidden="true"
                    >
                      /
                    </span>
                  ) : null}

                  {last ? (
                    <span
                      aria-current="page"
                      className="truncate font-medium text-white"
                    >
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="truncate text-neutral-500 transition-colors hover:text-neutral-200"
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

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setMobileSearchOpen((open) => !open)}
            aria-label="Search"
            className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
          >
            {mobileSearchOpen ? (
              <CloseIcon className="h-4 w-4" />
            ) : (
              <SearchIcon className="h-4 w-4" />
            )}
          </button>

          <NotificationBell />

          <button
            type="button"
            aria-label="Help"
            title="Help"
            className="hidden rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white sm:block"
          >
            <HelpIcon className="h-4 w-4" />
          </button>

          <div className="relative ml-1">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-md border border-white/10 py-1 pl-1.5 pr-2 text-left transition-colors hover:bg-white/[0.06]"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-neutral-100">
                {initialsFor(userLabel)}
              </span>

              <span className="hidden min-w-0 lg:block">
                <span className="block max-w-[10rem] truncate text-xs font-medium text-white">
                  {userLabel}
                </span>

                <span className="block max-w-[10rem] truncate text-[10px] text-neutral-500">
                  {dealershipName ?? "---"}
                </span>
              </span>

              <ChevronDownIcon className="h-3 w-3 shrink-0 text-neutral-500" />
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
                  className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-white/10 bg-neutral-900 shadow-xl"
                >
                  <div className="border-b border-white/10 px-3 py-2.5">
                    <p className="truncate text-xs font-medium text-white">
                      {userLabel}
                    </p>

                    <p className="truncate text-[10px] capitalize text-neutral-500">
                      {roleLabel ?? "---"}
                    </p>
                  </div>

                  <div className="border-b border-white/10 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      Dealership
                    </p>

                    <p className="mt-1 truncate text-xs text-neutral-200">
                      {dealershipName ?? "---"}
                    </p>
                  </div>

                  <div className="p-1.5">
                    <Link
                      href="/settings"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <SettingsIcon className="h-[16px] w-[16px]" />
                      Settings
                    </Link>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={onLogout}
                      disabled={loggingOut}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                    >
                      <LogoutIcon className="h-[16px] w-[16px]" />
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
        <div className="border-b border-white/10 bg-neutral-950 px-4 pb-3 md:hidden">
          {searchField}
        </div>
      ) : null}
    </header>
  );
}
