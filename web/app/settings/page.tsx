"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BackIcon,
  SettingsIcon,
  RefreshIcon,
  CheckIcon,
  XIcon,
  SaveIcon,
  PlusIcon,
  TrashIcon,
  CopyIcon,
  ShareIcon,
  UserIcon,
  BuildingIcon,
  ShieldIcon,
  UsersIcon,
  UserPlusIcon,
  ChevronDownIcon,
  ClockIcon,
} from "@/components/icons";

type Dealership = {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  subscription_plan: string;
};

type Member = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  created_at: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  token: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

type CustomerInvite = {
  id: string;
  customer_name: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const [dealership, setDealership] = useState<Dealership | null>(null);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [checkingRole, setCheckingRole] = useState(true);
  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [customerInvites, setCustomerInvites] = useState<CustomerInvite[]>([]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("salesperson");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [lastInviteLink, setLastInviteLink] = useState("");

  const [customerInviteName, setCustomerInviteName] = useState("");
  const [customerInviteEmail, setCustomerInviteEmail] = useState("");
  const [customerInviteLoading, setCustomerInviteLoading] = useState(false);
  const [customerInviteError, setCustomerInviteError] = useState("");
  const [lastCustomerInviteLink, setLastCustomerInviteLink] = useState("");

  const [customerSignupLink, setCustomerSignupLink] = useState("");
  const [customerSignupLoading, setCustomerSignupLoading] = useState(false);
  const [customerSignupError, setCustomerSignupError] = useState("");

  // Check user role first before loading anything
  useEffect(() => {
    async function checkRole() {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();
        if (data.profile?.role === "customer") {
          router.push("/leads");
          return;
        }
      } catch (err) {
        console.error("Failed to check user role:", err);
      } finally {
        setCheckingRole(false);
      }
    }
    checkRole();
  }, [router]);

  useEffect(() => {
    if (checkingRole) return;
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [
          dealershipRes,
          membersRes,
          invitesRes,
          signupLinkRes,
          customerInvitesRes,
        ] = await Promise.all([
          fetch("/api/dealership", { cache: "no-store" }),
          fetch("/api/team/members", { cache: "no-store" }),
          fetch("/api/team/invite", { cache: "no-store" }),
          fetch("/api/dealership/signup-link", { cache: "no-store" }),
          fetch("/api/customer/invite", { cache: "no-store" }),
        ]);

        const dealershipJson = await dealershipRes.json();
        if (!dealershipRes.ok || !dealershipJson.success) {
          throw new Error(dealershipJson.error || "Failed to load dealership.");
        }
        setDealership(dealershipJson.dealership);
        setRole(dealershipJson.role);

        const membersJson = await membersRes.json();
        if (membersJson.success) setMembers(membersJson.members);

        const invitesJson = await invitesRes.json();
        if (invitesJson.success) setInvites(invitesJson.invites);

        const signupLinkJson = await signupLinkRes.json();
        if (signupLinkJson.success) {
          setCustomerSignupLink(signupLinkJson.dealership.signupLink || "");
        }

        const customerInvitesJson = await customerInvitesRes.json();
        if (customerInvitesJson.success)
          setCustomerInvites(customerInvitesJson.invites);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load settings.",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [checkingRole]);

  const isAdmin = role === "admin";

  const handleSave = async () => {
    if (!dealership) return;

    try {
      setSaving(true);
      setSaved(false);
      setError("");

      const response = await fetch("/api/dealership", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dealership.name,
          logo_url: dealership.logo_url,
          phone: dealership.phone,
          email: dealership.email,
          website: dealership.website,
          address: dealership.address,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save.");
      }

      setDealership(result.dealership);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    setLastInviteLink("");

    if (!inviteEmail.includes("@")) {
      setInviteError("Enter a valid email.");
      return;
    }

    try {
      setInviteLoading(true);

      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to create invite.");
      }

      const link = `${window.location.origin}/signup?invite=${result.invite.token}`;
      setLastInviteLink(link);
      setInvites((prev) => [result.invite, ...prev]);
      setInviteEmail("");
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : "Failed to create invite.",
      );
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRegenerateCustomerSignup = async () => {
    try {
      setCustomerSignupLoading(true);
      setCustomerSignupError("");

      const response = await fetch("/api/dealership/signup-link", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to regenerate signup link.");
      }

      setCustomerSignupLink(result.dealership.signupLink);
    } catch (err) {
      setCustomerSignupError(
        err instanceof Error
          ? err.message
          : "Failed to regenerate signup link.",
      );
    } finally {
      setCustomerSignupLoading(false);
    }
  };

  const handleCustomerInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerInviteError("");
    setLastCustomerInviteLink("");

    if (!customerInviteName.trim()) {
      setCustomerInviteError("Please enter the customer's name.");
      return;
    }

    if (!customerInviteEmail.includes("@")) {
      setCustomerInviteError("Enter a valid email.");
      return;
    }

    try {
      setCustomerInviteLoading(true);

      const response = await fetch("/api/customer/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerInviteName,
          email: customerInviteEmail,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to create customer invitation.",
        );
      }

      const link = `${window.location.origin}/signup?invite=${result.invite.token}`;
      setLastCustomerInviteLink(link);
      setCustomerInvites((prev) => [result.invite, ...prev]);
      setCustomerInviteName("");
      setCustomerInviteEmail("");
    } catch (err) {
      setCustomerInviteError(
        err instanceof Error
          ? err.message
          : "Failed to create customer invitation.",
      );
    } finally {
      setCustomerInviteLoading(false);
    }
  };

  const handleDeleteCustomerInvite = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/customer/invite?id=${inviteId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to delete customer invitation.",
        );
      }

      setCustomerInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
    } catch (err) {
      setCustomerInviteError(
        err instanceof Error
          ? err.message
          : "Failed to delete customer invitation.",
      );
    }
  };

  const handleCopyCustomerSignup = async () => {
    try {
      await navigator.clipboard.writeText(customerSignupLink);
      // Optional: show success feedback
    } catch {
      setCustomerSignupError("Failed to copy link to clipboard.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
      {checkingRole && (
        <div className="flex items-center justify-center py-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
            <RefreshIcon className="h-5 w-5 animate-spin" />
          </span>
          <p className="ml-3 text-sm font-medium text-[#64748B]">
            Checking permissions...
          </p>
        </div>
      )}

      {loading && !checkingRole && (
        <div className="flex items-center justify-center py-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
            <RefreshIcon className="h-5 w-5 animate-spin" />
          </span>
          <p className="ml-3 text-sm font-medium text-[#64748B]">
            Loading settings...
          </p>
        </div>
      )}

      {!loading && !checkingRole && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-200 bg-red-100 text-red-600">
            <XIcon className="h-5 w-5" />
          </span>
          <h3 className="mt-4 text-base font-bold text-red-800">
            Unable to load settings
          </h3>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-50"
          >
            <RefreshIcon className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      {!loading && !checkingRole && dealership && (
        <>
          <div className="mb-5">
            <Link
              href="/"
              className="group mb-3 inline-flex items-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-3.5 py-2 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF] hover:text-[#1677FF]"
            >
              <BackIcon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
              <span>Back to Dashboard</span>
            </Link>

            <div className="rounded-2xl border border-[#DCE8F5] bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                  <SettingsIcon className="h-4 w-4" />
                </span>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">
                    Settings
                  </p>

                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                    Settings
                  </h1>

                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#64748B]">
                    Manage your dealership settings and account preferences.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {saved && (
            <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 shrink-0" />
                Changes saved successfully.
              </div>
            </div>
          )}

          {/* Dealership Branding */}
          <section className="mb-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                <BuildingIcon className="h-4 w-4" />
              </span>

              <div>
                <h2 className="text-base font-bold text-[#102A56]">
                  Dealership Branding
                </h2>

                <p className="text-xs text-[#64748B]">
                  Update your dealership information
                </p>
              </div>
            </div>

            {!isAdmin && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <div className="flex items-center gap-2">
                  <ShieldIcon className="h-4 w-4 shrink-0" />
                  Only dealership admins can edit these settings.
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  Dealership Name
                </label>
                <input
                  type="text"
                  value={dealership.name}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setDealership({ ...dealership, name: e.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 disabled:bg-[#F5F9FD] disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  Logo URL
                </label>
                <input
                  type="text"
                  value={dealership.logo_url ?? ""}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setDealership({ ...dealership, logo_url: e.target.value })
                  }
                  placeholder="https://..."
                  className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 disabled:bg-[#F5F9FD] disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  Phone
                </label>
                <input
                  type="text"
                  value={dealership.phone ?? ""}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setDealership({ ...dealership, phone: e.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 disabled:bg-[#F5F9FD] disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  Email
                </label>
                <input
                  type="email"
                  value={dealership.email ?? ""}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setDealership({ ...dealership, email: e.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 disabled:bg-[#F5F9FD] disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  Website
                </label>
                <input
                  type="text"
                  value={dealership.website ?? ""}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setDealership({ ...dealership, website: e.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 disabled:bg-[#F5F9FD] disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155]">
                  Address
                </label>
                <input
                  type="text"
                  value={dealership.address ?? ""}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setDealership({ ...dealership, address: e.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 disabled:bg-[#F5F9FD] disabled:text-gray-500"
                />
              </div>
            </div>

            {isAdmin && (
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1]"
                >
                  <SaveIcon className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </section>

          {/* Team */}
          <section className="mb-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                <UsersIcon className="h-4 w-4" />
              </span>

              <div>
                <h2 className="text-base font-bold text-[#102A56]">Team</h2>

                <p className="text-xs text-[#64748B]">
                  Manage your dealership team members
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-white text-[#1677FF]">
                      <UserIcon className="h-4 w-4" />
                    </span>

                    <div>
                      <p className="text-sm font-semibold text-[#102A56]">
                        {m.name || m.email || "—"}
                      </p>
                      <p className="text-xs text-[#64748B]">{m.email}</p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CFE2F5] bg-[#F5F9FD] px-2.5 py-1 text-xs font-semibold capitalize text-[#475569]">
                    <ShieldIcon className="h-3 w-3" />
                    {m.role}
                  </span>
                </div>
              ))}

              {members.length === 0 && (
                <div className="rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-10 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                    <UsersIcon className="h-5 w-5" />
                  </span>

                  <h3 className="mt-4 text-base font-bold text-[#102A56]">
                    No team members yet
                  </h3>

                  <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
                    No team members have been added to your dealership yet.
                  </p>
                </div>
              )}
            </div>

            {isAdmin && (
              <>
                <div className="mt-5 border-t border-[#E7EEF6] pt-5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                      <UserPlusIcon className="h-4 w-4" />
                    </span>

                    <div>
                      <h3 className="text-base font-bold text-[#102A56]">
                        Invite Customer
                      </h3>

                      <p className="text-xs text-[#64748B]">
                        Create a secure one-time invitation for a customer
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-[#64748B]">
                    The customer will be able to set their own password and will
                    be assigned read-only access to your dealership.
                  </p>

                  <form
                    onSubmit={handleCustomerInvite}
                    className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-[#334155]">
                        Customer Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Customer name"
                        value={customerInviteName}
                        onChange={(e) => setCustomerInviteName(e.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#334155]">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="customer@email.com"
                        value={customerInviteEmail}
                        onChange={(e) => setCustomerInviteEmail(e.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={customerInviteLoading}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1]"
                      >
                        <PlusIcon className="h-4 w-4" />
                        {customerInviteLoading
                          ? "Creating..."
                          : "Create Invite"}
                      </button>
                    </div>
                  </form>

                  {customerInviteError && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <div className="flex items-center gap-2">
                        <XIcon className="h-4 w-4 shrink-0" />
                        {customerInviteError}
                      </div>
                    </div>
                  )}

                  {lastCustomerInviteLink && (
                    <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                          <ShareIcon className="h-4 w-4" />
                        </span>

                        <div>
                          <p className="text-sm font-semibold text-[#334155]">
                            Customer invite created
                          </p>

                          <p className="text-xs text-[#64748B]">
                            Copy this link and send it to the customer using
                            your normal email or messaging service.
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <input
                          readOnly
                          value={lastCustomerInviteLink}
                          onFocus={(e) => e.target.select()}
                          className="flex-1 rounded-xl border border-[#DCE8F5] bg-white px-3.5 py-2.5 text-sm text-[#102A56]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              lastCustomerInviteLink,
                            );
                          }}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                        >
                          <CopyIcon className="h-4 w-4" />
                          Copy
                        </button>
                      </div>
                    </div>
                  )}

                  {customerInvites.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-[#334155]">
                        Pending Customer Invitations
                      </h4>

                      <ul className="mt-3 space-y-2">
                        {customerInvites.map((inv) => (
                          <li
                            key={inv.id}
                            className="flex items-center justify-between rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-white text-[#1677FF]">
                                <UserIcon className="h-4 w-4" />
                              </span>

                              <div>
                                <span className="text-sm font-semibold text-[#102A56]">
                                  {inv.customer_name}
                                </span>
                                <span className="mx-2 text-[#64748B]">·</span>
                                <span className="text-sm text-[#64748B]">
                                  {inv.email}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  inv.used_at
                                    ? "border border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
                                    : new Date(inv.expires_at) < new Date()
                                      ? "border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
                                      : "border border-[#FED7AA] bg-[#FFFBEB] text-[#92400E]"
                                }`}
                              >
                                {inv.used_at ? (
                                  <>
                                    <CheckIcon className="h-3 w-3" />
                                    Joined
                                  </>
                                ) : new Date(inv.expires_at) < new Date() ? (
                                  <>
                                    <XIcon className="h-3 w-3" />
                                    Expired
                                  </>
                                ) : (
                                  <>
                                    <ClockIcon className="h-3 w-3" />
                                    Pending
                                  </>
                                )}
                              </span>

                              {!inv.used_at &&
                                new Date(inv.expires_at) > new Date() && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteCustomerInvite(inv.id)
                                    }
                                    className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                    Delete
                                  </button>
                                )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-5 border-t border-[#E7EEF6] pt-5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                      <UserPlusIcon className="h-4 w-4" />
                    </span>

                    <div>
                      <h3 className="text-base font-bold text-[#102A56]">
                        Add Staff Member
                      </h3>

                      <p className="text-xs text-[#64748B]">
                        Invite staff to your dealership
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-[#64748B]">
                    Creates a secure one-time invite link. No email is sent by
                    Supabase, so this flow is not affected by Supabase email
                    rate limits.
                  </p>

                  <form
                    onSubmit={handleInvite}
                    className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-[#334155]">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="teammate@dealership.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#334155]">
                        Role
                      </label>

                      <div className="relative mt-2">
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                        >
                          <option value="salesperson">Salesperson</option>
                          <option value="manager">Manager</option>
                        </select>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                          <ChevronDownIcon className="h-4 w-4" />
                        </span>
                      </div>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={inviteLoading}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1]"
                      >
                        <PlusIcon className="h-4 w-4" />
                        {inviteLoading ? "Creating..." : "Create Invite"}
                      </button>
                    </div>
                  </form>

                  {inviteError && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <div className="flex items-center gap-2">
                        <XIcon className="h-4 w-4 shrink-0" />
                        {inviteError}
                      </div>
                    </div>
                  )}

                  {lastInviteLink && (
                    <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                          <ShareIcon className="h-4 w-4" />
                        </span>

                        <div>
                          <p className="text-sm font-semibold text-[#334155]">
                            Staff invite created
                          </p>

                          <p className="text-xs text-[#64748B]">
                            Copy this link and send it to the staff member using
                            your normal email or messaging service.
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <input
                          readOnly
                          value={lastInviteLink}
                          onFocus={(e) => e.target.select()}
                          className="flex-1 rounded-xl border border-[#DCE8F5] bg-white px-3.5 py-2.5 text-sm text-[#102A56]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(lastInviteLink);
                          }}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                        >
                          <CopyIcon className="h-4 w-4" />
                          Copy
                        </button>
                      </div>
                    </div>
                  )}

                  {invites.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-[#334155]">
                        Pending Staff Invitations
                      </h4>

                      <ul className="mt-3 space-y-2">
                        {invites.map((inv) => (
                          <li
                            key={inv.id}
                            className="flex items-center justify-between rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-white text-[#1677FF]">
                                <UserIcon className="h-4 w-4" />
                              </span>

                              <div>
                                <span className="text-sm font-semibold text-[#102A56]">
                                  {inv.email}
                                </span>
                                <span className="mx-2 text-[#64748B]">·</span>
                                <span className="text-sm text-[#64748B]">
                                  {inv.role}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                inv.used_at
                                  ? "border border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
                                  : new Date(inv.expires_at) < new Date()
                                    ? "border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
                                    : "border border-[#FED7AA] bg-[#FFFBEB] text-[#92400E]"
                              }`}
                            >
                              {inv.used_at ? (
                                <>
                                  <CheckIcon className="h-3 w-3" />
                                  Joined
                                </>
                              ) : new Date(inv.expires_at) < new Date() ? (
                                <>
                                  <XIcon className="h-3 w-3" />
                                  Expired
                                </>
                              ) : (
                                <>
                                  <ClockIcon className="h-3 w-3" />
                                  Pending
                                </>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Customer Signup Link */}
          {isAdmin && (
            <section className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                  <ShareIcon className="h-4 w-4" />
                </span>

                <div>
                  <h2 className="text-base font-bold text-[#102A56]">
                    Customer Signup
                  </h2>

                  <p className="text-xs text-[#64748B]">
                    Generate a secure signup link for customers
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm text-[#64748B]">
                Generate a secure signup link that customers can use to sign up
                for your dealership. Customers will be able to create their own
                accounts and will be assigned to your dealership.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  readOnly
                  value={customerSignupLink}
                  placeholder="No signup link generated yet"
                  className="flex-1 rounded-xl border border-[#DCE8F5] bg-white px-3.5 py-2.5 text-sm text-[#102A56]"
                />

                <button
                  type="button"
                  onClick={handleRegenerateCustomerSignup}
                  disabled={customerSignupLoading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1]"
                >
                  <RefreshIcon className="h-4 w-4" />
                  {customerSignupLoading ? "Generating..." : "Generate Link"}
                </button>

                {customerSignupLink && (
                  <button
                    type="button"
                    onClick={handleCopyCustomerSignup}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                  >
                    <CopyIcon className="h-4 w-4" />
                    Copy
                  </button>
                )}
              </div>

              {!customerSignupLink && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <div className="flex items-center gap-2">
                    <XIcon className="h-4 w-4 shrink-0" />
                    No signup link available. Click &quot;Generate Link&quot; to create
                    one.
                  </div>
                </div>
              )}

              {customerSignupError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <div className="flex items-center gap-2">
                    <XIcon className="h-4 w-4 shrink-0" />
                    {customerSignupError}
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}


