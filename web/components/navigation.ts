import type { ReactElement } from "react";
import type { IconProps } from "./icons";
import {
  CrmIcon,
  DashboardIcon,
  IntegrationsIcon,
  LeadsIcon,
  PlatformIcon,
  ReportsIcon,
  SaasIcon,
  SettingsIcon,
  StaffIcon,
  TradeInsIcon,
  VehiclesIcon,
} from "./icons";

export type NavItem = {
  href: string;
  label: string;
  icon: (props: IconProps) => ReactElement;
};

export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/vehicles", label: "Vehicles", icon: VehiclesIcon },
  { href: "/trade-appraisals", label: "Trade-Ins", icon: TradeInsIcon },
  { href: "/leads", label: "Leads", icon: LeadsIcon },
  { href: "/crm", label: "CRM", icon: CrmIcon },
  { href: "/reports", label: "Reports", icon: ReportsIcon },
  { href: "/integrations", label: "Integrations", icon: IntegrationsIcon },
];

export const CUSTOMER_NAV: NavItem[] = [
  { href: "/leads", label: "Leads", icon: LeadsIcon },
  { href: "/customers", label: "Customers", icon: CrmIcon },
  { href: "/crm", label: "CRM", icon: CrmIcon },
  { href: "/reports", label: "Reports", icon: ReportsIcon },
];

export const MANAGEMENT_NAV: NavItem[] = [
  { href: "/staff", label: "Staff", icon: StaffIcon },
  { href: "/saas", label: "SaaS", icon: SaasIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export const PLATFORM_NAV: NavItem = {
  href: "/platform",
  label: "Platform",
  icon: PlatformIcon,
};

const EXTRA_SEGMENT_LABELS: Record<string, string> = {
  activities: "Activities",
  customers: "Customers",
  new: "New",
  edit: "Edit",
};

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function initialsFor(value: string) {
  const parts = value.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part[0] ?? "").join("");
  return letters.toUpperCase() || "S";
}

function labelForSegment(segment: string, href: string) {
  const navMatch = [...MAIN_NAV, ...MANAGEMENT_NAV, PLATFORM_NAV].find(
    (item) => item.href === href
  );

  if (navMatch) return navMatch.label;

  const extra = EXTRA_SEGMENT_LABELS[segment];

  if (extra) return extra;

  const decoded = decodeURIComponent(segment);

  if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(decoded)) return decoded.toUpperCase();

  return decoded
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export type Crumb = {
  href: string;
  label: string;
};

export function breadcrumbsFor(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ href: "/", label: "Dashboard" }];

  const segments = pathname.split("/").filter(Boolean);

  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;

    crumbs.push({ href, label: labelForSegment(segment, href) });
  });

  return crumbs;
}
