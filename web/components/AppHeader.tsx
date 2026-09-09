"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Profile = {
  name: string | null;
  email: string | null;
  role: string;
  dealership_id: string | null;
};

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/trade-appraisals", label: "Trade-Ins" },
  { href: "/leads", label: "Leads" },
  { href: "/crm", label: "CRM" },
  { href: "/reports", label: "Reports" },
  { href: "/integrations", label: "Integrations" },
  { href: "/staff", label: "Staff" },
  { href: "/saas", label: "SaaS" },
  { href: "/settings", label: "Settings" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [dealershipName, setDealershipName] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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

    router.push("/login");
    router.refresh();
  };

  const navigationLinks = isPlatformAdmin
    ? [...NAV_LINKS, { href: "/platform", label: "Platform" }]
    : NAV_LINKS;

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div>
          <Link href="/" className="text-2xl font-bold text-gray-900">
            Shiftly Auto
          </Link>

          <p className="text-sm text-gray-500">
            Vehicle Intelligence
          </p>
        </div>

        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-5 text-sm md:flex">
            {navigationLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  pathname === link.href
                    ? "font-medium text-gray-900"
                    : "text-gray-500 transition hover:text-gray-900"
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4 border-l pl-6">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {dealershipName ?? "---"}
              </p>

              <p className="text-xs capitalize text-gray-500">
                {profile?.name ||
                  profile?.email ||
                  profile?.role ||
                  "..."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
            >
              {loggingOut ? "..." : "Logout"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
