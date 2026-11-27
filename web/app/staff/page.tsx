"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BackIcon,
  RefreshIcon,
  CopyIcon,
  UserPlusIcon,
  UsersIcon,
  StaffIcon,
  UserIcon,
  XIcon,
  CheckIcon,
  ShareIcon,
  DollarSignIcon,
  ChevronDownIcon,
} from "@/components/icons";

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

function getRoleIcon(role: string) {
  switch (role.toLowerCase()) {
    case "manager":
    case "admin":
      return StaffIcon;
    case "salesperson":
      return DollarSignIcon;
    case "customer":
      return UserIcon;
    default:
      return UserIcon;
  }
}

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
  const [showForm, setShowForm] = useState(false);

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
    setTimeout(() => {
      void load();
    }, 0);
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
      setSuccess(
        "Staff invite created. Copy the link and send it to the staff member.",
      );
      setEmail("");
      setInvites((current) => [result.invite, ...current]);
      setShowForm(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create staff invite.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
      {checkingRole && (
        <div className="flex items-center justify-center py-8">
          Checking permissions...
        </div>
      )}

      {!checkingRole && (
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                      <StaffIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-base font-semibold text-[#0F172A]">
                        Staff Management
                      </p>
                      <p className="text-sm text-[#64748B]">
                        Manage your dealership team and their access.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                  {!showForm && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(true);
                      }}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/20"
                    >
                      <UserPlusIcon className="h-4 w-4 shrink-0" />
                      Add Staff
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-center gap-2">
                <XIcon className="h-4 w-4 shrink-0" />
                {error}
              </div>
            </div>
          )}
          {success && (
            <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 shrink-0" />
                {success}
              </div>
            </div>
          )}

          {showForm && (
            <section
              id="add-staff-form"
              className="mb-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                  <UserPlusIcon className="h-4 w-4" />
                </span>

                <div>
                  <h2 className="text-base font-bold text-[#102A56]">
                    Add Staff Member
                  </h2>

                  <p className="mt-2 text-sm text-[#64748B]">
                    Create a secure invite link for a manager or salesperson.
                  </p>
                </div>
              </div>

              <form
                onSubmit={createInvite}
                className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]"
              >
                <div>
                  <label
                    className="block text-sm font-semibold text-[#334155]"
                    htmlFor="staff-email"
                  >
                    Email
                  </label>

                  <div className="relative mt-2">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#64748B]">
                      <UserIcon className="h-4 w-4" />
                    </span>
                    <input
                      id="staff-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="staff@example.com"
                      disabled={creating}
                      className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white pl-10 pr-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 disabled:bg-[#F5F9FD]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-semibold text-[#334155]"
                    htmlFor="staff-role"
                  >
                    Role
                  </label>

                  <div className="relative mt-2">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#64748B]">
                      <StaffIcon className="h-4 w-4" />
                    </span>
                    <select
                      id="staff-role"
                      value={role}
                      onChange={(e) =>
                        setRole(e.target.value as "salesperson" | "manager")
                      }
                      disabled={creating}
                      className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white pl-10 pr-10 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 disabled:bg-[#F5F9FD]"
                    >
                      <option value="salesperson">Salesperson</option>
                      <option value="manager">Manager</option>
                    </select>
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[#64748B]">
                      <ChevronDownIcon className="h-4 w-4" />
                    </span>
                  </div>
                </div>

                <div className="col-span-1 flex items-end justify-end gap-2 md:col-span-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("");
                      setRole("salesperson");
                      setInviteLink("");
                      setSuccess("");
                      setShowForm(false);
                    }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                  >
                    <XIcon className="h-4 w-4" />
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={creating}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1]"
                  >
                    <ShareIcon className="h-4 w-4" />
                    {creating ? "Creating Invite..." : "Send Invite"}
                  </button>
                </div>
              </form>

              {inviteLink && (
                <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                      <ShareIcon className="h-4 w-4" />
                    </span>

                    <div>
                      <p className="text-sm font-semibold text-[#334155]">
                        Invite Link
                      </p>

                      <p className="mt-2 text-sm text-[#64748B]">
                        Copy and send this link to the staff member. The link
                        expires automatically.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      readOnly
                      value={inviteLink}
                      onFocus={(e) => e.target.select()}
                      className="flex-1 rounded-xl border border-[#DCE8F5] bg-white px-3.5 py-2.5 text-sm text-[#102A56]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                        setSuccess("Invite link copied to clipboard!");
                      }}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                    >
                      <CopyIcon className="h-4 w-4" />
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="mb-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                  <UsersIcon className="h-4 w-4" />
                </span>

                <div>
                  <h2 className="text-base font-bold text-[#102A56]">
                    Dealership Staff
                  </h2>

                  <p className="mt-2 text-sm text-[#64748B]">
                    {loading
                      ? "Loading..."
                      : `${members.length} staff member${members.length === 1 ? "" : "s"}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-3 text-xs font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF] disabled:opacity-50"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-8 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                  <RefreshIcon className="h-5 w-5 animate-spin" />
                </span>
                <p className="mt-2 text-sm text-[#64748B]">
                  Loading staff...
                </p>
              </div>
            ) : members.length === 0 ? (
              <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-10 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                  <UsersIcon className="h-5 w-5" />
                </span>

                <h3 className="mt-4 text-base font-bold text-[#102A56]">
                  No staff members found
                </h3>

                <p className="mt-2 text-sm text-[#64748B]">
                  No staff members have been added yet. Use the form above to
                  invite team members.
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[700px] text-left">
                  <thead className="border-b border-[#DCE8F5] bg-[#F8FBFF]">
                    <tr>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        Name
                      </th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        Email
                      </th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        Role
                      </th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7EEF6]">
                    {members.map((m) => (
                      <tr
                        key={m.id}
                        className="transition-colors hover:bg-[#F8FBFF]"
                      >
                        <td className="px-4 py-3 text-sm font-semibold text-[#102A56]">
                          {m.name || "Unnamed User"}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#475569]">
                          {m.email || "No email"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full border border-[#CFE2F5] bg-[#F5F9FD] px-2.5 py-1 text-xs font-semibold capitalize text-[#475569]">
                            {(() => {
                              const RoleIcon = getRoleIcon(m.role);
                              return <RoleIcon className="mr-1.5 h-3 w-3" />;
                            })()}
                            {m.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-2.5 py-1 text-xs font-semibold text-[#166534]">
                            <CheckIcon className="mr-1.5 h-3 w-3" />
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                <ShareIcon className="h-4 w-4" />
              </span>

              <div>
                <h2 className="text-base font-bold text-[#102A56]">
                  Pending Invites
                </h2>

              <p className="mt-2 text-sm text-[#64748B]">
                  Track sent invites that haven&apos;t been accepted yet.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {invites
                .filter((i) => !i.used_at)
                .map((i) => (
                  <div
                    key={i.id}
                    className="flex flex-col gap-1 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#102A56]">
                        {i.email}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-[#CFE2F5] bg-[#F5F9FD] px-2 py-0.5 text-xs font-semibold capitalize text-[#475569]">
                        {(() => {
                          const RoleIcon = getRoleIcon(i.role);
                          return <RoleIcon className="mr-1 h-3 w-3" />;
                        })()}
                        {i.role}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        new Date(i.expires_at) > new Date()
                          ? "border border-[#FED7AA] bg-[#FFFBEB] text-[#92400E]"
                          : "border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
                      }`}
                    >
                      {new Date(i.expires_at) > new Date() ? (
                        <>
                          <CheckIcon className="h-3 w-3" />
                          Pending
                        </>
                      ) : (
                        <>
                          <XIcon className="h-3 w-3" />
                          Expired
                        </>
                      )}
                    </span>
                  </div>
                ))}
              {invites.filter((i) => !i.used_at).length === 0 && (
                <div className="rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-10 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                    <ShareIcon className="h-5 w-5" />
                  </span>

                  <h3 className="mt-4 text-base font-bold text-[#102A56]">
                    No pending invites
                  </h3>

                  <p className="mt-2 text-sm text-[#64748B]">
                    All invites have been accepted or have expired.
                  </p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
