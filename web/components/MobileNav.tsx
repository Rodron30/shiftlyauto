"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  VehiclesIcon,
  LeadsIcon,
  SettingsIcon,
} from "./icons";

type NavItem = {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
};

const MOBILE_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/vehicles", label: "Vehicles", icon: VehiclesIcon },
  { href: "/leads", label: "Leads", icon: LeadsIcon },
  { href: "/settings", label: "More", icon: SettingsIcon },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-[#DCE8F5] bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14">
        {MOBILE_NAV.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const ItemIcon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 transition-colors ${
                isActive ? "text-[#1677FF]" : "text-[#8B9DB3]"
              }`}
            >
              <ItemIcon className="h-4 w-4 shrink-0" />
              <span className="mt-0.5 text-[10px] font-medium truncate">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}


