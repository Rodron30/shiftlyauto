"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

        const [dealershipRes, membersRes, invitesRes, signupLinkRes, customerInvitesRes] = await Promise.all([
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
          setCustomerSignupLink(signupLinkJson.dealership.signupLink);
        }

        const customerInvitesJson = await customerInvitesRes.json();
        if (customerInvitesJson.success) setCustomerInvites(customerInvitesJson.invites);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings.");
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
      setInviteError(err instanceof Error ? err.message : "Failed to create invite.");
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
      setCustomerSignupError(err instanceof Error ? err.message : "Failed to regenerate signup link.");
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
        throw new Error(result.error || "Failed to create customer invitation.");
      }

      const link = `${window.location.origin}/signup?invite=${result.invite.token}`;
      setLastCustomerInviteLink(link);
      setCustomerInvites((prev) => [result.invite, ...prev]);
      setCustomerInviteName("");
      setCustomerInviteEmail("");
    } catch (err) {
      setCustomerInviteError(err instanceof Error ? err.message : "Failed to create customer invitation.");
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
        throw new Error(result.error || "Failed to delete customer invitation.");
      }

      setCustomerInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
    } catch (err) {
      setCustomerInviteError(err instanceof Error ? err.message : "Failed to delete customer invitation.");
    }
  };

  const handleCopyCustomerSignup = async () => {
    try {
      await navigator.clipboard.writeText(customerSignupLink);
      // Optional: show success feedback
    } catch (err) {
      setCustomerSignupError("Failed to copy link to clipboard.");
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Settings</h1>

      {checkingRole && (
        <p className="mt-6 text-sm text-neutral-500">Checking permissions...</p>
      )}

      {loading && !checkingRole && (
        <p className="mt-6 text-sm text-neutral-500">Loading settings...</p>
      )}

      {!loading && !checkingRole && error && (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && !checkingRole && dealership && (
        <>
          {/* Branding */}
          <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-neutral-900">
              Dealership Branding
            </h2>
            {!isAdmin && (
              <p className="mt-1 text-xs text-amber-700">
                Only dealership admins can edit these settings.
              </p>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Dealership Name"
                value={dealership.name}
                disabled={!isAdmin}
                onChange={(v) => setDealership({ ...dealership, name: v })}
              />
              <Field
                label="Logo URL"
                value={dealership.logo_url ?? ""}
                  disabled={!isAdmin}
                  onChange={(v) =>
                    setDealership({ ...dealership, logo_url: v })
                  }
                  placeholder="https://..."
                />
                <Field
                  label="Phone"
                  value={dealership.phone ?? ""}
                  disabled={!isAdmin}
                  onChange={(v) => setDealership({ ...dealership, phone: v })}
                />
                <Field
                  label="Email"
                  value={dealership.email ?? ""}
                  disabled={!isAdmin}
                  onChange={(v) => setDealership({ ...dealership, email: v })}
                />
                <Field
                  label="Website"
                  value={dealership.website ?? ""}
                  disabled={!isAdmin}
                  onChange={(v) =>
                    setDealership({ ...dealership, website: v })
                  }
                />
                <Field
                  label="Address"
                  value={dealership.address ?? ""}
                  disabled={!isAdmin}
                  onChange={(v) =>
                    setDealership({ ...dealership, address: v })
                  }
                />
              </div>

              {isAdmin && (
                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  {saved && (
                    <span className="text-sm text-green-700">Saved.</span>
                  )}
                </div>
              )}
            </section>

            {/* Team */}
            <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-neutral-900">Team</h2>

              <ul className="mt-4 space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-lg bg-neutral-50 px-4 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-neutral-900">
                        {m.name || m.email || "—"}
                      </p>
                      <p className="text-xs text-neutral-500">{m.email}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium capitalize text-neutral-700 ring-1 ring-neutral-200">
                      {m.role}
                    </span>
                  </li>
                ))}
                {members.length === 0 && (
                  <p className="text-sm text-neutral-500">No team members yet.</p>
                )}
              </ul>

              {isAdmin && (
                <div className="mt-6 border-t border-neutral-100 pt-5">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Invite Customer
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Create a secure one-time invitation for a customer. The customer will be able to set their own password and will be assigned read-only access to your dealership.
                  </p>
                  <form
                    onSubmit={handleCustomerInvite}
                    className="mt-3 flex flex-col gap-2 sm:flex-row"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Customer name"
                      value={customerInviteName}
                      onChange={(e) => setCustomerInviteName(e.target.value)}
                      className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                    />
                    <input
                      type="email"
                      required
                      placeholder="customer@email.com"
                      value={customerInviteEmail}
                      onChange={(e) => setCustomerInviteEmail(e.target.value)}
                      className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                    />
                    <button
                      type="submit"
                      disabled={customerInviteLoading}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                    >
                      {customerInviteLoading ? "Creating..." : "Create Invite"}
                    </button>
                  </form>

                  {customerInviteError && (
                    <p className="mt-2 text-sm text-red-600">{customerInviteError}</p>
                  )}

                  {lastCustomerInviteLink && (
                    <div className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm">
                      <p className="font-medium text-neutral-700">
                        Customer invite created
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Copy this link and send it to the customer using your normal email or messaging service.
                      </p>
                      <input
                        readOnly
                        value={lastCustomerInviteLink}
                        onFocus={(e) => e.target.select()}
                        className="mt-1 w-full truncate rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700"
                      />
                    </div>
                  )}

                  {customerInvites.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold text-neutral-700">Pending Customer Invitations</h4>
                      <ul className="mt-2 space-y-1.5">
                        {customerInvites.map((inv) => (
                          <li
                            key={inv.id}
                            className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600"
                          >
                            <div>
                              <span className="font-medium text-neutral-900">{inv.customer_name}</span>
                              <span className="mx-1 text-neutral-400">·</span>
                              <span>{inv.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>
                                {inv.used_at
                                  ? "Joined"
                                  : new Date(inv.expires_at) < new Date()
                                    ? "Expired"
                                    : "Pending"}
                              </span>
                              {!inv.used_at && new Date(inv.expires_at) > new Date() && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomerInvite(inv.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
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
              )}

              {isAdmin && (
                <div className="mt-6 border-t border-neutral-100 pt-5">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Add Staff Member
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Creates a secure one-time invite link. No email is sent by Supabase, so this flow is not affected by Supabase email rate limits.
                  </p>
                  <form
                    onSubmit={handleInvite}
                    className="mt-3 flex flex-col gap-2 sm:flex-row"
                  >
                    <input
                      type="email"
                      required
                      placeholder="teammate@dealership.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                    >
                      <option value="salesperson">Salesperson</option>
                      <option value="manager">Manager</option>
                    </select>
                    <button
                      type="submit"
                      disabled={inviteLoading}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                    >
                      {inviteLoading ? "Creating..." : "Create Invite"}
                    </button>
                  </form>

                  {inviteError && (
                    <p className="mt-2 text-sm text-red-600">{inviteError}</p>
                  )}

                  {lastInviteLink && (
                    <div className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm">
                      <p className="font-medium text-neutral-700">
                        Staff invite created
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Copy this link and send it to the staff member using your normal email or messaging service.
                      </p>
                      <input
                        readOnly
                        value={lastInviteLink}
                        onFocus={(e) => e.target.select()}
                        className="mt-1 w-full truncate rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700"
                      />
                    </div>
                  )}

                  {invites.length > 0 && (
                    <ul className="mt-4 space-y-1.5">
                      {invites.map((inv) => (
                        <li
                          key={inv.id}
                          className="flex items-center justify-between text-xs text-neutral-500"
                        >
                          <span>
                            {inv.email} · {inv.role}
                          </span>
                          <span>
                            {inv.used_at
                              ? "Joined"
                              : new Date(inv.expires_at) < new Date()
                                ? "Expired"
                                : "Pending"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </>
        )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-500"
      />
    </div>
  );
}

