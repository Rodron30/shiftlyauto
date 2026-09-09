"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";

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

export default function StaffPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"salesperson" | "manager">("salesperson");
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [membersRes, invitesRes] = await Promise.all([
        fetch("/api/team/members", { cache: "no-store" }),
        fetch("/api/team/invite", { cache: "no-store" }),
      ]);
      const membersJson = await membersRes.json();
      const invitesJson = await invitesRes.json();
      if (!membersRes.ok || !membersJson.success) {
        throw new Error(membersJson.error || "Failed to load staff.");
      }
      if (!invitesRes.ok || !invitesJson.success) {
        throw new Error(invitesJson.error || "Failed to load invites.");
      }
      setMembers(membersJson.members ?? []);
      setInvites(invitesJson.invites ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setInviteLink("");
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError("Please enter a valid email address.");
      return;
    }
    try {
      setCreating(true);
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, role }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to create staff invite.");
      }
      const link = `${window.location.origin}/signup?invite=${result.invite.token}`;
      setInviteLink(link);
      setSuccess("Staff invite created. Copy the link and send it to the staff member.");
      setEmail("");
      setInvites((current) => [result.invite, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create staff invite.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Shiftly Auto</p>
            <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
            <p className="mt-1 text-sm text-gray-500">Manage users belonging to your dealership.</p>
          </div>
          <Link href="/" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50">← Back</Link>
        </div>

        {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">{success}</div>}

        <section className="mb-8 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-5">
            <h2 className="font-semibold">Add Staff Member</h2>
            <p className="mt-1 text-sm text-gray-500">Create a secure invite link for a manager or salesperson. No Supabase invitation email is sent.</p>
          </div>
          <form onSubmit={createInvite} className="grid gap-5 p-6 md:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700" htmlFor="staff-email">Email</label>
              <input id="staff-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@example.com" disabled={creating} className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-black disabled:bg-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700" htmlFor="staff-role">Role</label>
              <select id="staff-role" value={role} onChange={(e) => setRole(e.target.value as "salesperson" | "manager")} disabled={creating} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-black disabled:bg-gray-100">
                <option value="salesperson">Salesperson</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={creating} className="w-full rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300">{creating ? "Creating Invite..." : "Create Staff Invite"}</button>
            </div>
          </form>
          {inviteLink && (
            <div className="mx-6 mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800">Invite link</p>
              <p className="mt-1 text-xs text-gray-500">Copy and send this link to the staff member. The link expires automatically.</p>
              <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700" />
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
            <div><h2 className="font-semibold">Dealership Staff</h2><p className="mt-1 text-sm text-gray-500">{loading ? "Loading..." : `${members.length} staff member${members.length === 1 ? "" : "s"}`}</p></div>
            <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Refresh</button>
          </div>
          {loading ? <div className="px-6 py-14 text-center text-sm text-gray-500">Loading staff...</div> : members.length === 0 ? <div className="px-6 py-14 text-center text-sm text-gray-500">No staff members found.</div> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead className="border-b border-gray-200 bg-gray-50"><tr><th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">Name</th><th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">Email</th><th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">Role</th><th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{members.map((m) => <tr key={m.id} className="hover:bg-gray-50"><td className="px-6 py-5 font-semibold">{m.name || "Unnamed User"}</td><td className="px-6 py-5 text-sm text-gray-600">{m.email || "No email"}</td><td className="px-6 py-5"><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-700">{m.role}</span></td><td className="px-6 py-5"><span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"><span className="h-2 w-2 rounded-full bg-green-500" />Active</span></td></tr>)}</tbody></table></div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">Pending Invites</h2>
          <div className="mt-4 space-y-2">
            {invites.filter((i) => !i.used_at).map((i) => <div key={i.id} className="flex flex-col gap-1 rounded-lg bg-gray-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span><strong>{i.email}</strong> · {i.role}</span><span className="text-xs text-gray-500">{new Date(i.expires_at) > new Date() ? "Pending" : "Expired"}</span></div>)}
            {invites.filter((i) => !i.used_at).length === 0 && <p className="text-sm text-gray-500">No pending invites.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}



