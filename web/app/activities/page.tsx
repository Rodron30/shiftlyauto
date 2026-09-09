"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";

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
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "SMS":
      return "bg-green-50 text-green-700 border-green-200";
    case "EMAIL":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "MEETING":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "FOLLOW_UP":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "STATUS_CHANGE":
      return "bg-pink-50 text-pink-700 border-pink-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
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

  async function loadActivities() {
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

      const response = await fetch(
        `/api/activities?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to load activities"
        );
      }

      setActivities(data.activities ?? []);
    } catch (err) {
      console.error("Activity load error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load activities"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomers() {
    try {
      const response = await fetch("/api/customers", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to load customers"
        );
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
        throw new Error(
          data?.error || "Unable to load leads"
        );
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
            user.role === "admin"
        )
      );
    } catch (err) {
      console.error("Salesperson load error:", err);
    }
  }

  useEffect(() => {
    loadCustomers();
    loadLeads();
    loadSalespeople();
  }, []);

  useEffect(() => {
    loadActivities();
  }, [customerFilter, leadFilter, userFilter]);

  const visibleActivities = useMemo(() => {
    if (!typeFilter) {
      return activities;
    }

    return activities.filter(
      (activity) => activity.activity_type === typeFilter
    );
  }, [activities, typeFilter]);

  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId
  );

  const availableLeads = useMemo(() => {
    if (!customerId) {
      return leads;
    }

    return leads.filter(
      (lead) => lead.customer_id === customerId
    );
  }, [leads, customerId]);

  function handleCustomerChange(value: string) {
    setCustomerId(value);

    if (leadId) {
      const selectedLead = leads.find(
        (lead) => lead.id === leadId
      );

      if (
        selectedLead &&
        value &&
        selectedLead.customer_id !== value
      ) {
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
          activityAt: activityAt
            ? new Date(activityAt).toISOString()
            : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to create activity"
        );
      }

      setSuccess("Activity recorded successfully.");
      setDescription("");
      setActivityAt("");

      await loadActivities();
    } catch (err) {
      console.error("Activity save error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create activity"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Salesperson Activity
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            Track calls, messages, emails, meetings, follow-ups,
            notes, and lead status changes.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Record Activity
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Add a new salesperson interaction.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Activity Type
                </label>

                <select
                  value={activityType}
                  onChange={(event) =>
                    setActivityType(event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
                >
                  {ACTIVITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Customer
                </label>

                <select
                  value={customerId}
                  onChange={(event) =>
                    handleCustomerChange(event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
                >
                  <option value="">No customer selected</option>

                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.phone
                        ? ` - ${customer.phone}`
                        : ""}
                    </option>
                  ))}
                </select>

                {selectedCustomer && (
                  <div className="mt-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
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
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Lead
                </label>

                <select
                  value={leadId}
                  onChange={(event) =>
                    setLeadId(event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
                >
                  <option value="">No lead selected</option>

                  {availableLeads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.customer_name} - {lead.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Activity Date / Time
                </label>

                <input
                  type="datetime-local"
                  value={activityAt}
                  onChange={(event) =>
                    setActivityAt(event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  rows={5}
                  placeholder="Describe the customer interaction..."
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Record Activity"}
              </button>
            </form>
          </section>

          <section className="min-w-0">
            <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Activity History
                  </h2>

                  <p className="text-sm text-gray-500">
                    {visibleActivities.length} activity
                    {visibleActivities.length === 1 ? "" : "ies"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadActivities}
                  disabled={loading}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <select
                  value={customerFilter}
                  onChange={(event) =>
                    setCustomerFilter(event.target.value)
                  }
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                >
                  <option value="">All Customers</option>

                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>

                <select
                  value={leadFilter}
                  onChange={(event) =>
                    setLeadFilter(event.target.value)
                  }
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                >
                  <option value="">All Leads</option>

                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.customer_name}
                    </option>
                  ))}
                </select>

                <select
                  value={userFilter}
                  onChange={(event) =>
                    setUserFilter(event.target.value)
                  }
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                >
                  <option value="">All Salespeople</option>

                  {salespeople.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email || "User"}
                    </option>
                  ))}
                </select>

                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value)
                  }
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                >
                  <option value="">All Activity Types</option>

                  {ACTIVITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
                Loading activity history...
              </div>
            ) : visibleActivities.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
                <h3 className="font-semibold text-gray-900">
                  No activities found
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Record a customer interaction to start the
                  activity history.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleActivities.map((activity) => (
                  <article
                    key={activity.id}
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${typeClass(
                              activity.activity_type
                            )}`}
                          >
                            {TYPE_LABELS[
                              activity.activity_type
                            ] || activity.activity_type}
                          </span>

                          <span className="text-xs text-gray-400">
                            {formatDateTime(
                              activity.activity_at
                            )}
                          </span>
                        </div>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800">
                          {activity.description}
                        </p>
                      </div>

                      <div className="shrink-0 text-left sm:text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {activity.user?.name ||
                            activity.user?.email ||
                            "Salesperson"}
                        </div>

                        <div className="mt-1 text-xs capitalize text-gray-500">
                          {activity.user?.role || "salesperson"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                      {activity.customer && (
                        <span className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-700">
                          Customer: {activity.customer.name}
                        </span>
                      )}

                      {activity.lead && (
                        <span className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-700">
                          Lead: {activity.lead.customer_name}
                        </span>
                      )}

                      {activity.lead?.status && (
                        <span className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-700">
                          Status: {activity.lead.status}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

