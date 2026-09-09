"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";

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

export default function SettingsPage() {
  const [dealership, setDealership] = useState<Dealership | null>(null);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("salesperson");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [lastInviteLink, setLastInviteLink] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [dealershipRes, membersRes, invitesRes] = await Promise.all([
          fetch("/api/dealership", { cache: "no-store" }),
          fetch("/api/team/members", { cache: "no-store" }),
          fetch("/api/team/invite", { cache: "no-store" }),
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

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

  return (
    <main className="min-h-screen bg-gray-100">
      <AppHeader />

      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        {loading && (
          <p className="mt-6 text-sm text-gray-500">Loading settings...</p>
        )}

        {!loading && error && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {!loading && dealership && (
          <>
            {/* Branding */}
            <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900">
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
            <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900">Team</h2>

              <ul className="mt-4 space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {m.name || m.email || "—"}
                      </p>
                      <p className="text-xs text-gray-500">{m.email}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium capitalize text-gray-700 ring-1 ring-gray-200">
                      {m.role}
                    </span>
                  </li>
                ))}
                {members.length === 0 && (
                  <p className="text-sm text-gray-500">No team members yet.</p>
                )}
              </ul>

              {isAdmin && (
                <div className="mt-6 border-t border-gray-100 pt-5">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Add Staff Member
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
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
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                    >
                      <option value="salesperson">Salesperson</option>
                      <option value="manager">Manager</option>
                    </select>
                    <button
                      type="submit"
                      disabled={inviteLoading}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {inviteLoading ? "Creating..." : "Create Invite"}
                    </button>
                  </form>

                  {inviteError && (
                    <p className="mt-2 text-sm text-red-600">{inviteError}</p>
                  )}

                  {lastInviteLink && (
                    <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
                      <p className="font-medium text-gray-700">
                        Staff invite created
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Copy this link and send it to the staff member using your normal email or messaging service.
                      </p>
                      <input
                        readOnly
                        value={lastInviteLink}
                        onFocus={(e) => e.target.select()}
                        className="mt-1 w-full truncate rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700"
                      />
                    </div>
                  )}

                  {invites.length > 0 && (
                    <ul className="mt-4 space-y-1.5">
                      {invites.map((inv) => (
                        <li
                          key={inv.id}
                          className="flex items-center justify-between text-xs text-gray-500"
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
    </main>
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
      <label className="block text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-black disabled:bg-gray-50 disabled:text-gray-500"
      />
    </div>
  );
}
