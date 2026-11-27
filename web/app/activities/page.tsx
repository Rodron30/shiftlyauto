"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  BackIcon,
  RefreshIcon,
  CheckIcon,
  XIcon,
  SaveIcon,
  ClockIcon,
  UserIcon,
  PlusIcon,
  BellIcon,
  FileTextIcon,
  CalendarIcon,
  ChevronDownIcon,
} from "@/components/icons";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type Lead = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  status: string;
};

type Salesperson = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
};

type Activity = {
  id: string;
  dealership_id: string;
  customer_id: string | null;
  lead_id: string | null;
  user_id: string;
  activity_type: string;
  description: string;
  activity_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  customer?: Customer | null;
  lead?: Lead | null;
  user?: Salesperson | null;
};

const ACTIVITY_TYPES = [
  "CALL",
  "SMS",
  "EMAIL",
  "MEETING",
  "NOTE",
  "FOLLOW_UP",
  "STATUS_CHANGE",
] as const;

const TYPE_LABELS: Record<string, string> = {
  CALL: "Call",
  SMS: "SMS",
  EMAIL: "Email",
  MEETING: "Meeting",
  NOTE: "Note",
  FOLLOW_UP: "Follow Up",
  STATUS_CHANGE: "Status Change",
};

function formatDateTime(value: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function typeClass(type: string) {
  switch (type) {
    case "CALL":
      return "border border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]";
    case "SMS":
      return "border border-[#FED7AA] bg-[#FFFBEB] text-[#92400E]";
    case "EMAIL":
      return "border border-[#E9D5FF] bg-[#FAF5FF] text-[#7C3AED]";
    case "MEETING":
      return "border border-[#FED7AA] bg-[#FFFBEB] text-[#92400E]";
    case "FOLLOW_UP":
      return "border border-[#FED7AA] bg-[#FFFBEB] text-[#92400E]";
    case "STATUS_CHANGE":
      return "border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]";
    default:
      return "border border-[#CFE2F5] bg-[#F5F9FD] text-[#475569]";
  }
}

function typeIcon(type: string) {
  switch (type) {
    case "CALL":
      return BellIcon;
    case "SMS":
      return FileTextIcon;
    case "EMAIL":
      return FileTextIcon;
    case "MEETING":
      return CalendarIcon;
    case "NOTE":
      return FileTextIcon;
    case "FOLLOW_UP":
      return ClockIcon;
    case "STATUS_CHANGE":
      return RefreshIcon;
    default:
      return FileTextIcon;
  }
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [customerFilter, setCustomerFilter] = useState("");
  const [leadFilter, setLeadFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [activityType, setActivityType] = useState("CALL");
  const [customerId, setCustomerId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [description, setDescription] = useState("");
  const [activityAt, setActivityAt] = useState("");

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (customerFilter) {
        params.set("customerId", customerFilter);
      }

      if (leadFilter) {
        params.set("leadId", leadFilter);
      }

      if (userFilter) {
        params.set("userId", userFilter);
      }

      params.set("limit", "200");

      const response = await fetch(`/api/activities?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load activities");
      }

      setActivities(data.activities ?? []);
    } catch (err) {
      console.error("Activity load error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to load activities",
      );
    } finally {
      setLoading(false);
    }
  }, [customerFilter, leadFilter, userFilter]);

  async function loadCustomers() {
    try {
      const response = await fetch("/api/customers", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load customers");
      }

      setCustomers(data.customers ?? []);
    } catch (err) {
      console.error("Customer load error:", err);
    }
  }

  async function loadLeads() {
    try {
      const response = await fetch("/api/leads", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load leads");
      }

      setLeads(data.leads ?? []);
    } catch (err) {
      console.error("Lead load error:", err);
    }
  }

  async function loadSalespeople() {
    try {
      const response = await fetch("/api/crm/salespeople", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      setSalespeople(
        (data.users ?? []).filter(
          (user: Salesperson) =>
            user.role === "salesperson" ||
            user.role === "manager" ||
            user.role === "admin",
        ),
      );
    } catch (err) {
      console.error("Salesperson load error:", err);
    }
  }

  useEffect(() => {
    // These async loaders update state after their fetch completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCustomers();
    loadLeads();
    loadSalespeople();
  }, []);

  const visibleActivities = useMemo(() => {
    if (!typeFilter) {
      return activities;
    }

    return activities.filter(
      (activity) => activity.activity_type === typeFilter,
    );
  }, [activities, typeFilter]);
  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );

  const availableLeads = useMemo(() => {
    if (!customerId) {
      return leads;
    }

    return leads.filter((lead) => lead.customer_id === customerId);
  }, [leads, customerId]);

  function handleCustomerChange(value: string) {
    setCustomerId(value);

    if (leadId) {
      const selectedLead = leads.find((lead) => lead.id === leadId);

      if (selectedLead && value && selectedLead.customer_id !== value) {
        setLeadId("");
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!description.trim()) {
        setError("Activity description is required.");
        return;
      }

      const response = await fetch("/api/activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activityType,
          customerId: customerId || null,
          leadId: leadId || null,
          description: description.trim(),
          activityAt: activityAt ? new Date(activityAt).toISOString() : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to create activity");
      }

      setSuccess("Activity recorded successfully.");
      setDescription("");
      setActivityAt("");

      await loadActivities();
    } catch (err) {
      console.error("Activity save error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to create activity",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
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
              <BellIcon className="h-4 w-4" />
            </span>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                Salesperson Activity
              </h1>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#64748B]">
                Track calls, messages, emails, meetings, follow-ups, notes, and
                lead status changes.
              </p>
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

      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
              <PlusIcon className="h-4 w-4" />
            </span>

            <div>
              <h2 className="text-base font-bold text-[#102A56]">
                Record Activity
              </h2>

              <p className="text-xs text-[#64748B]">
                Add a new salesperson interaction
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#334155]">
                Activity Type
              </label>

              <div className="relative mt-2">
                <select
                  value={activityType}
                  onChange={(event) => setActivityType(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                >
                  {ACTIVITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                  <ChevronDownIcon className="h-4 w-4" />
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#334155]">
                Customer
              </label>

              <div className="relative mt-2">
                <select
                  value={customerId}
                  onChange={(event) => handleCustomerChange(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                >
                  <option value="">No customer selected</option>

                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.phone ? ` - ${customer.phone}` : ""}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                  <ChevronDownIcon className="h-4 w-4" />
                </span>
              </div>

              {selectedCustomer && (
                <div className="mt-2 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-3 text-xs text-[#64748B]">
                  {selectedCustomer.phone && (
                    <div>Phone: {selectedCustomer.phone}</div>
                  )}

                  {selectedCustomer.email && (
                    <div>Email: {selectedCustomer.email}</div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#334155]">
                Lead
              </label>

              <div className="relative mt-2">
                <select
                  value={leadId}
                  onChange={(event) => setLeadId(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                >
                  <option value="">No lead selected</option>

                  {availableLeads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.customer_name} - {lead.status}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                  <ChevronDownIcon className="h-4 w-4" />
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#334155]">
                Activity Date / Time
              </label>

              <input
                type="datetime-local"
                value={activityAt}
                onChange={(event) => setActivityAt(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#334155]">
                Description
              </label>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="Describe the customer interaction..."
                className="mt-2 w-full resize-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 py-2.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1]"
            >
              <SaveIcon className="h-4 w-4" />
              {saving ? "Saving..." : "Record Activity"}
            </button>
          </form>
        </section>

        <section className="min-w-0">
          <div className="mb-4 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                  <ClockIcon className="h-4 w-4" />
                </span>

                <div>
                  <h2 className="text-base font-bold text-[#102A56]">
                    Activity History
                  </h2>

                  <p className="text-xs text-[#64748B]">
                    {visibleActivities.length} activity
                    {visibleActivities.length === 1 ? "" : "ies"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={loadActivities}
                disabled={loading}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-3 text-xs font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF] disabled:opacity-50"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="relative">
                <select
                  value={customerFilter}
                  onChange={(event) => setCustomerFilter(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                >
                  <option value="">All Customers</option>

                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                  <ChevronDownIcon className="h-4 w-4" />
                </span>
              </div>

              <div className="relative">
                <select
                  value={leadFilter}
                  onChange={(event) => setLeadFilter(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                >
                  <option value="">All Leads</option>

                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.customer_name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                  <ChevronDownIcon className="h-4 w-4" />
                </span>
              </div>

              <div className="relative">
                <select
                  value={userFilter}
                  onChange={(event) => setUserFilter(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                >
                  <option value="">All Salespeople</option>

                  {salespeople.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email || "User"}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                  <ChevronDownIcon className="h-4 w-4" />
                </span>
              </div>

              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                >
                  <option value="">All Activity Types</option>

                  {ACTIVITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                  <ChevronDownIcon className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                <RefreshIcon className="h-5 w-5 animate-spin" />
              </span>
              <p className="ml-3 text-sm font-medium text-[#64748B]">
                Loading activity history...
              </p>
            </div>
          ) : visibleActivities.length === 0 ? (
            <div className="rounded-2xl border border-[#DCE8F5] bg-white p-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                <ClockIcon className="h-5 w-5" />
              </span>

              <h3 className="mt-4 text-base font-bold text-[#102A56]">
                No activities found
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
                Record a customer interaction to start the activity history.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleActivities.map((activity) => {
                const TypeIcon = typeIcon(activity.activity_type);

                return (
                  <article
                    key={activity.id}
                    className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                            <TypeIcon className="h-4 w-4" />
                          </span>

                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${typeClass(
                              activity.activity_type,
                            )}`}
                          >
                            {TYPE_LABELS[activity.activity_type] ||
                              activity.activity_type}
                          </span>

                          <span className="flex items-center gap-1.5 text-xs text-[#64748B]">
                            <ClockIcon className="h-3.5 w-3.5" />
                            {formatDateTime(activity.activity_at)}
                          </span>
                        </div>

                        <p className="mt-2.5 whitespace-pre-wrap text-sm leading-6 text-[#334155]">
                          {activity.description}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#102A56]">
                          <UserIcon className="h-3.5 w-3.5" />
                          {activity.user?.name ||
                            activity.user?.email ||
                            "Salesperson"}
                        </div>

                        <div className="text-xs capitalize text-[#64748B]">
                          {activity.user?.role || "salesperson"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 border-t border-[#E7EEF6] pt-3">
                      {activity.customer && (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] px-2.5 py-1.5 text-xs text-[#475569]">
                          <UserIcon className="h-3.5 w-3.5" />
                          Customer: {activity.customer.name}
                        </span>
                      )}

                      {activity.lead && (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] px-2.5 py-1.5 text-xs text-[#475569]">
                          <UserIcon className="h-3.5 w-3.5" />
                          Lead: {activity.lead.customer_name}
                        </span>
                      )}

                      {activity.lead?.status && (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] px-2.5 py-1.5 text-xs text-[#475569]">
                          <RefreshIcon className="h-3.5 w-3.5" />
                          Status: {activity.lead.status}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}



