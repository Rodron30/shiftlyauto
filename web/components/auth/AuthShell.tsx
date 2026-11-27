"use client";

import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  headline?: ReactNode;
  lead?: string;
};

export const authCls = {
  card:
    "w-full max-w-[480px] rounded-2xl border border-[#DCE8F5] bg-white px-5 py-6 shadow-none sm:px-8 sm:py-8",

  title:
    "text-center text-[26px] font-bold tracking-[-0.03em] leading-tight text-[#102A56] sm:text-[30px]",

  sub:
    "mt-2 text-center text-sm leading-6 text-[#64748B]",

  label:
    "mb-1.5 block text-xs font-semibold text-[#1E3A5F]",

  input:
    "h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-all placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]",

  iconLeft:
    "pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-[#94A3B8]",

  error:
    "rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-sm leading-5 text-[#B42318]",

  info:
    "rounded-xl border border-[#A7F3D0] bg-[#ECFDF3] px-3 py-2.5 text-sm leading-5 text-[#047857]",

  primary:
    "flex h-11 w-full items-center justify-center rounded-lg bg-[#1677FF] px-4 text-[14px] font-semibold text-white transition-all hover:bg-[#1267DC] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1677FF]/20 disabled:cursor-not-allowed disabled:opacity-50",

  secondary:
    "flex h-11 w-full items-center justify-center rounded-lg border border-[#DCE6F2] bg-white px-4 text-[14px] font-medium text-[#1E3A5F] transition-all hover:border-[#B8D0EB] hover:bg-[#F5F9FD] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/10 disabled:cursor-not-allowed disabled:opacity-50",

  google:
    "flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-[#DCE6F2] bg-white px-4 text-[14px] font-semibold text-[#1E3A5F] transition-all hover:border-[#B8D0EB] hover:bg-[#F8FBFF] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1677FF]/10 disabled:cursor-not-allowed disabled:opacity-50",
};

export const AuthIcons = {
  car: ({ className = "" }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 17h14" />
      <path d="M6.5 17 5 12l1.5-4h11L19 12l-1.5 5" />
      <path d="M7 12h10" />
      <circle cx="8" cy="17" r="1.5" />
      <circle cx="16" cy="17" r="1.5" />
    </svg>
  ),

  mail: ({ className = "" }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),

  lock: ({ className = "" }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  ),

  user: ({ className = "" }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5" />
    </svg>
  ),

  login: ({ className = "" }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  ),

  userPlus: ({ className = "" }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="3.5" />
      <path d="M2.5 18.5a6.5 6.5 0 0 1 11 0" />
      <path d="M16 8.5v4" />
      <path d="M16 6.5h4" />
    </svg>
  ),

  building: ({ className = "" }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <path d="M9 22v-4h6" />
      <path d="M8 6h1" />
      <path d="M15 6h1" />
      <path d="M8 10h1" />
      <path d="M15 10h1" />
      <path d="M8 14h1" />
      <path d="M15 14h1" />
    </svg>
  ),
};

export default function AuthShell({
  children,
  headline,
  lead,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#F5F9FD] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full items-center justify-center">
        <section className={authCls.card}>
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1677FF] text-white">
                <AuthIcons.car className="h-5 w-5" />
              </div>

              <span className="text-[21px] font-bold tracking-[-0.03em] text-[#102A56]">
                Shiftly Auto
              </span>
            </div>

            <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">
              Vehicle Intelligence
            </div>
          </div>

          {headline && (
            <div className="mb-1">
              {headline}
            </div>
          )}

          {lead && (
            <p className={authCls.sub}>
              {lead}
            </p>
          )}

          <div className="mt-6 w-full">
            {children}
          </div>

          <p className="mt-7 border-t border-[#EEF2F6] pt-5 text-center text-[11px] leading-5 text-[#94A3B8]">
            © {new Date().getFullYear()} Shiftly Auto. All rights reserved.
          </p>
        </section>
      </div>
    </main>
  );
}

