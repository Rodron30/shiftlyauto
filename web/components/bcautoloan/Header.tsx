"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

type MenuItem = {
  name: string;
  href: string;
  description: string;
  icon: React.ReactNode;
};

const iconClass = "h-5 w-5";

const BCAutoLoanPath = (path: string) => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.toLowerCase();

    if (
      hostname === "bcautoloan.ca" ||
      hostname === "www.bcautoloan.ca"
    ) {
      return path === "/bcautoloan" ? "/" : path.replace(/^\/bcautoloan/, "");
    }
  }

  return path;
};

const navigation: MenuItem[] = [
  {
    name: "Find Your Vehicle",
    href: "/bcautoloan/find-your-vehicle",
    description: "Find a vehicle that fits your needs and budget.",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 17h14M6 17l1-5h10l1 5M8 12l1.5-4h5L16 12M4 17v2m16-2v2" />
        <circle cx="7" cy="17" r="1.5" />
        <circle cx="17" cy="17" r="1.5" />
      </svg>
    ),
  },
  {
    name: "How It Works",
    href: "/bcautoloan/how-it-works",
    description: "See how the BCAutoLoan process works from start to finish.",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },

];

const preApprovalItems: MenuItem[] = [
  {
    name: "Get Pre-Approved",
    href: "/bcautoloan/pre-approved",
    description: "Start your pre-approval application with a simple process.",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4 4L19 6.5" />
        <rect x="3" y="3" width="18" height="18" rx="4" />
      </svg>
    ),
  },
  {
    name: "How It Works",
    href: "/bcautoloan/how-it-works",
    description: "Understand each step before you get started.",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M12 7v5l3 2" />
      </svg>
    ),
  },
];

const sellItems: MenuItem[] = [
  {
    name: "Sell Your Car",
    href: "/bcautoloan/sell-your-car",
    description: "Submit your vehicle details and let our team review them.",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 17h14M6 17l1-5h10l1 5M8 12l1.5-4h5L16 12M4 17v2m16-2v2" />
        <circle cx="7" cy="17" r="1.5" />
        <circle cx="17" cy="17" r="1.5" />
      </svg>
    ),
  },
  {
    name: "How It Works",
    href: "/bcautoloan/how-it-works",
    description: "See what happens after you submit your vehicle.",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h15M14 7l5 5-5 5" />
      </svg>
    ),
  },
];

const aboutItems: MenuItem[] = [
  {
    name: "About BCAutoLoan",
    href: "/bcautoloan/about",
    description: "Learn more about BCAutoLoan and what we do.",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M12 10v6" />
        <circle cx="12" cy="7" r=".7" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "Our Approach",
    href: "/bcautoloan/how-it-works",
    description: "Making the vehicle-buying journey easier to understand.",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 18l5-5 3 3 8-9" />
        <path strokeLinecap="round" d="M15 7h5v5" />
      </svg>
    ),
  },
];

function MegaMenu({
  label,
  items,
  open,
  onOpen,
  onClose,
}: {
  label: string;
  items: MenuItem[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-bc-text-secondary transition-colors hover:bg-bc-surface-light hover:text-bc-text-primary"
      >
        {label}

        <svg
          className={`h-4 w-4 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.5 7.5L10 12l4.5-4.5 1 1L10 14 4.5 8.5l1-1z" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 w-[min(560px,calc(100vw-32px))] pt-3 sm:w-[min(560px,calc(100vw-40px))]"
          onMouseEnter={onOpen}
        >
          <div className="rounded-2xl border border-bc-border bg-bc-surface p-3 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {items.map((item) => (
                <Link
                  key={item.name}
                  href={BCAutoLoanPath(item.href)}
                  onClick={onClose}
                  className="group rounded-xl border border-transparent p-4 transition-all hover:border-bc-border hover:bg-bc-surface-light"
                >
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bc-primary/10 text-bc-primary transition-colors group-hover:bg-bc-primary group-hover:text-white">
                      {item.icon}
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-bc-text-primary">
                        {item.name}
                      </div>

                      <p className="mt-1 text-xs leading-5 text-bc-text-secondary">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-bc-surface-light px-4 py-3">
              <span className="text-xs text-bc-text-secondary">
                Ready to get started?
              </span>

              <Link
                href={BCAutoLoanPath("/bcautoloan/pre-approved")}
                onClick={onClose}
                className="text-xs font-semibold text-bc-primary hover:underline"
              >
                Get Pre-Approved
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const closeMenus = () => {
    setOpenMenu(null);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-bc-border bg-bc-surface/95 backdrop-blur-md">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-6">
          <Link
            href={BCAutoLoanPath("/bcautoloan")}
            className="flex shrink-0 items-center gap-3"
            onClick={closeMenus}
          >
            <div className="relative h-10 w-10">
              <Image
                src="/images/bcautoloan/logo.png"
                alt="BCAutoLoan Logo"
                fill
                className="object-contain"
                sizes="40px"
              />
            </div>

            <span className="text-xl font-bold tracking-tight text-bc-text-primary">
              BCAutoLoan
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            <Link
              href={BCAutoLoanPath("/bcautoloan")}
              className="rounded-lg px-3 py-2 text-sm font-medium text-bc-text-secondary transition-colors hover:bg-bc-surface-light hover:text-bc-text-primary"
            >
              Home
            </Link>

            <MegaMenu
              label="Get Pre-Approved"
              items={preApprovalItems}
              open={openMenu === "pre-approved"}
              onOpen={() =>
                setOpenMenu("pre-approved")
              }
              onClose={() => setOpenMenu(null)}
            />

            <MegaMenu
              label="Sell Your Car"
              items={sellItems}
              open={openMenu === "sell"}
              onOpen={() => setOpenMenu("sell")}
              onClose={() => setOpenMenu(null)}
            />

            <MegaMenu
              label="About"
              items={aboutItems}
              open={openMenu === "about"}
              onOpen={() => setOpenMenu("about")}
              onClose={() => setOpenMenu(null)}
            />

            <Link
              href={BCAutoLoanPath("/bcautoloan/contact")}
              className="rounded-lg px-3 py-2 text-sm font-medium text-bc-text-secondary transition-colors hover:bg-bc-surface-light hover:text-bc-text-primary"
            >
              Contact
            </Link>

            <Link
              href={BCAutoLoanPath("/bcautoloan/pre-approved")}
              className="ml-2 rounded-xl bg-bc-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-bc-primary-dark hover:shadow-md"
            >
              Get Pre-Approved
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl border border-bc-border p-2 text-bc-text-secondary transition-colors hover:bg-bc-surface-light hover:text-bc-text-primary md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.7"
              stroke="currentColor"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="border-t border-bc-border bg-bc-surface md:hidden">
          <div className="space-y-1 px-4 pb-5 pt-3">
            <Link
              href={BCAutoLoanPath("/bcautoloan")}
              className="block rounded-xl px-4 py-3 text-sm font-medium text-bc-text-secondary hover:bg-bc-surface-light"
              onClick={closeMenus}
            >
              Home
            </Link>

            {[
              ...preApprovalItems,
              ...sellItems,
              ...navigation,
              ...aboutItems,
            ]
              .filter(
                (item, index, array) =>
                  array.findIndex(
                    (candidate) =>
                      candidate.name === item.name && candidate.href === item.href
                  ) === index
              )
              .map((item) => (
                <Link
                  key={`${item.name}-${item.href}`}
                  href={BCAutoLoanPath(item.href)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-bc-text-secondary hover:bg-bc-surface-light"
                  onClick={closeMenus}
                >
                  <span className="text-bc-primary">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              ))}

            <Link
              href={BCAutoLoanPath("/bcautoloan/contact")}
              className="block rounded-xl px-4 py-3 text-sm font-medium text-bc-text-secondary hover:bg-bc-surface-light"
              onClick={closeMenus}
            >
              Contact
            </Link>

            <Link
              href={BCAutoLoanPath("/bcautoloan/pre-approved")}
              className="mt-3 block rounded-xl bg-bc-primary px-4 py-3 text-center text-sm font-semibold text-white"
              onClick={closeMenus}
            >
              Get Pre-Approved
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
















