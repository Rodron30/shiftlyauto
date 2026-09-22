"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingRole, setCheckingRole] = useState(true);
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
    void load();
  }, [checkingRole, load]);

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
    <div className="p-6 lg:p-8">
      {checkingRole && (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-neutral-600">Checking permissions...</div>
        </div>
      )}

      {!checkingRole && (
        <>
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Shiftly Auto</p>
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Staff Management</h1>
                <p className="mt-1 text-sm text-neutral-600">Manage users belonging to your dealership.</p>
              </div>
              <Link href="/" className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50">← Back</Link>
            </div>

            {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}
            {success && <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">{success}</div>}

            <section className="mb-8 rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-6 py-5">
            <h2 className="font-semibold text-neutral-900">Add Staff Member</h2>
            <p className="mt-1 text-sm text-neutral-600">Create a secure invite link for a manager or salesperson. No Supabase invitation email is sent.</p>
          </div>
          <form onSubmit={createInvite} className="grid gap-5 p-6 md:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-neutral-700" htmlFor="staff-email">Email</label>
              <input id="staff-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@example.com" disabled={creating} className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 disabled:bg-neutral-100" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700" htmlFor="staff-role">Role</label>
              <select id="staff-role" value={role} onChange={(e) => setRole(e.target.value as "salesperson" | "manager")} disabled={creating} className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 disabled:bg-neutral-100">
                <option value="salesperson">Salesperson</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={creating} className="w-full rounded-lg bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300">{creating ? "Creating Invite..." : "Create Staff Invite"}</button>
            </div>
          </form>
          {inviteLink && (
            <div className="mx-6 mb-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-sm font-semibold text-neutral-800">Invite link</p>
              <p className="mt-1 text-xs text-neutral-500">Copy and send this link to the staff member. The link expires automatically.</p>
              <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} className="mt-3 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700" />
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5">
            <div><h2 className="font-semibold text-neutral-900">Dealership Staff</h2><p className="mt-1 text-sm text-neutral-600">{loading ? "Loading..." : `${members.length} staff member${members.length === 1 ? "" : "s"}`}</p></div>
            <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">Refresh</button>
          </div>
          {loading ? <div className="px-6 py-14 text-center text-sm text-neutral-500">Loading staff...</div> : members.length === 0 ? <div className="px-6 py-14 text-center text-sm text-neutral-500">No staff members found.</div> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead className="border-b border-neutral-200 bg-neutral-50"><tr><th className="px-6 py-4 text-xs font-semibold uppercase text-neutral-500">Name</th><th className="px-6 py-4 text-xs font-semibold uppercase text-neutral-500">Email</th><th className="px-6 py-4 text-xs font-semibold uppercase text-neutral-500">Role</th><th className="px-6 py-4 text-xs font-semibold uppercase text-neutral-500">Status</th></tr></thead><tbody className="divide-y divide-neutral-100">{members.map((m) => <tr key={m.id} className="hover:bg-neutral-50"><td className="px-6 py-5 font-semibold text-neutral-900">{m.name || "Unnamed User"}</td><td className="px-6 py-5 text-sm text-neutral-600">{m.email || "No email"}</td><td className="px-6 py-5"><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold capitalize text-neutral-700">{m.role}</span></td><td className="px-6 py-5"><span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"><span className="h-2 w-2 rounded-full bg-green-500" />Active</span></td></tr>)}</tbody></table></div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-neutral-900">Pending Invites</h2>
          <div className="mt-4 space-y-2">
            {invites.filter((i) => !i.used_at).map((i) => <div key={i.id} className="flex flex-col gap-1 rounded-lg bg-neutral-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span><strong>{i.email}</strong> · {i.role}</span><span className="text-xs text-neutral-500">{new Date(i.expires_at) > new Date() ? "Pending" : "Expired"}</span></div>)}
            {invites.filter((i) => !i.used_at).length === 0 && <p className="text-sm text-neutral-500">No pending invites.</p>}
          </div>
        </section>
        </>
      )}
    </div>
  );
}




