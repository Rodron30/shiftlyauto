"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";

type Vehicle = {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
};

type Customer = {
  id: string;
  dealership_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Lead = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  interest_note: string | null;
  budget: number | null;
  financing_preference: string | null;
  status: string;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
  customer?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
  } | null;
  vehicle: {
    vin: string;
    year: number;
    make: string;
    model: string;
    trim: string | null;
  } | null;
};

const STATUSES = [
  "NEW",
  "CONTACTED",
  "NEGOTIATING",
  "WON",
  "LOST",
];

const STATUS_CLASSES: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-amber-100 text-amber-700",
  NEGOTIATING: "bg-purple-100 text-purple-700",
  WON: "bg-green-100 text-green-700",
  LOST: "bg-gray-200 text-gray-600",
};

function formatNumberInput(value: string) {
  const cleaned = value.replace(/,/g, "").replace(/[^\d]/g, "");

  if (!cleaned) {
    return "";
  }

  return Number(cleaned).toLocaleString("en-US");
}

function formatCurrency(value: number) {
  return `PHP ${value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [vehicleId, setVehicleId] = useState("");
  const [interestNote, setInterestNote] = useState("");
  const [budget, setBudget] = useState("");
  const [financingPreference, setFinancingPreference] =
    useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [savingLeadId, setSavingLeadId] = useState<string | null>(
    null
  );

  const [editingFollowUpId, setEditingFollowUpId] =
    useState<string | null>(null);

  const [editingNotesId, setEditingNotesId] =
    useState<string | null>(null);

  const [editFollowUpDate, setEditFollowUpDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const loadLeads = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/leads", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load leads.");
      }

      setLeads(result.leads ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load leads."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await fetch("/api/customers", {
        cache: "no-store",
      });

      const result = await response.json();

      if (response.ok) {
        setCustomers(result.customers ?? []);
      }
    } catch {
      // Customer loading is non-critical for the rest of the page.
    }
  };

  const loadVehicles = async () => {
    try {
      const response = await fetch("/api/vehicles", {
        cache: "no-store",
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setVehicles(result.vehicles ?? []);
      }
    } catch {
      // Vehicle linking is optional.
    }
  };

  useEffect(() => {
    loadLeads();
    loadCustomers();
    loadVehicles();
  }, []);

  const resetForm = () => {
    setCustomerId("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setVehicleId("");
    setInterestNote("");
    setBudget("");
    setFinancingPreference("");
    setFollowUpDate("");
    setNotes("");
    setFormError("");
  };

  const handleCustomerSelect = (value: string) => {
    setCustomerId(value);

    if (!value) {
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      return;
    }

    const customer = customers.find((item) => item.id === value);

    if (!customer) {
      return;
    }

    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || "");
    setCustomerEmail(customer.email || "");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!customerName.trim()) {
      setFormError("Customer name is required.");
      return;
    }

    if (!customerPhone.trim() && !customerEmail.trim()) {
      setFormError("Provide a phone number or an email address.");
      return;
    }

    const parsedBudget = budget
      ? Number(budget.replace(/,/g, ""))
      : undefined;

    if (
      parsedBudget !== undefined &&
      (!Number.isFinite(parsedBudget) || parsedBudget < 0)
    ) {
      setFormError("Enter a valid budget.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: customerId || undefined,
          customerName,
          customerPhone: customerPhone || undefined,
          customerEmail: customerEmail || undefined,
          vehicleId: vehicleId || undefined,
          interestNote: interestNote || undefined,
          budget: parsedBudget,
          financingPreference:
            financingPreference || undefined,
          followUpDate: followUpDate || undefined,
          notes: notes || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save lead.");
      }

      resetForm();
      setShowForm(false);

      await Promise.all([
        loadLeads(),
        loadCustomers(),
      ]);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save lead."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (
    leadId: string,
    newStatus: string
  ) => {
    const previousLeads = leads;

    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId
          ? { ...lead, status: newStatus }
          : lead
      )
    );

    setSavingLeadId(leadId);

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update status.");
      }
    } catch (err) {
      console.error("Status update error:", err);
      setLeads(previousLeads);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update status."
      );
    } finally {
      setSavingLeadId(null);
    }
  };

  const startFollowUpEdit = (lead: Lead) => {
    setEditingFollowUpId(lead.id);
    setEditingNotesId(null);
    setEditFollowUpDate(lead.follow_up_date || "");
  };

  const cancelFollowUpEdit = () => {
    setEditingFollowUpId(null);
    setEditFollowUpDate("");
  };

  const saveFollowUp = async (leadId: string) => {
    setSavingLeadId(leadId);

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          followUpDate: editFollowUpDate || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to update follow-up."
        );
      }

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                follow_up_date: editFollowUpDate || null,
              }
            : lead
        )
      );

      cancelFollowUpEdit();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update follow-up."
      );
    } finally {
      setSavingLeadId(null);
    }
  };

  const startNotesEdit = (lead: Lead) => {
    setEditingNotesId(lead.id);
    setEditingFollowUpId(null);
    setEditNotes(lead.notes || "");
  };

  const cancelNotesEdit = () => {
    setEditingNotesId(null);
    setEditNotes("");
  };

  const saveNotes = async (leadId: string) => {
    setSavingLeadId(leadId);

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes: editNotes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to update notes."
        );
      }

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                notes: editNotes.trim() || null,
              }
            : lead
        )
      );

      cancelNotesEdit();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update notes."
      );
    } finally {
      setSavingLeadId(null);
    }
  };

  const visibleLeads = leads.filter((lead) => {
    const matchesStatus =
      statusFilter === "ALL" ||
      lead.status === statusFilter;

    const matchesCustomer =
      customerFilter === "ALL" ||
      lead.customer_id === customerFilter;

    const searchValue = search.trim().toLowerCase();

    const matchesSearch =
      !searchValue ||
      lead.customer_name.toLowerCase().includes(searchValue) ||
      (lead.customer_phone || "")
        .toLowerCase()
        .includes(searchValue) ||
      (lead.customer_email || "")
        .toLowerCase()
        .includes(searchValue) ||
      (lead.vehicle?.vin || "")
        .toLowerCase()
        .includes(searchValue) ||
      (lead.vehicle?.make || "")
        .toLowerCase()
        .includes(searchValue) ||
      (lead.vehicle?.model || "")
        .toLowerCase()
        .includes(searchValue);

    return (
      matchesStatus &&
      matchesCustomer &&
      matchesSearch
    );
  });

  const statusCounts = STATUSES.reduce(
    (counts, status) => {
      counts[status] = leads.filter(
        (lead) => lead.status === status
      ).length;

      return counts;
    },
    {} as Record<string, number>
  );

  return (
    <main className="min-h-screen bg-gray-100">
      <AppHeader />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">
              Vehicle Intelligence
            </p>

            <h1 className="mt-1 text-3xl font-bold text-gray-900">
              Leads
            </h1>

            <p className="mt-2 max-w-2xl text-gray-600">
              Track customer interest from first contact to sale.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!showForm) {
                resetForm();
              }

              setShowForm((value) => !value);
            }}
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-700"
          >
            {showForm ? "Cancel" : "+ New Lead"}
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow ${
                statusFilter === status
                  ? "border-gray-900"
                  : "border-gray-200"
              }`}
            >
              <p className="text-xs font-medium text-gray-500">
                {formatStatus(status)}
              </p>

              <p className="mt-1 text-2xl font-bold text-gray-900">
                {statusCounts[status] || 0}
              </p>
            </button>
          ))}
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  New Lead
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Link the lead to an existing customer or create a
                  new customer automatically.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-xs font-medium text-gray-500">
                Existing Customer
              </label>

              <select
                value={customerId}
                onChange={(e) =>
                  handleCustomerSelect(e.target.value)
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
              >
                <option value="">
                  New customer
                </option>

                {customers.map((customer) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.name}
                    {customer.phone
                      ? ` - ${customer.phone}`
                      : ""}
                    {customer.email
                      ? ` - ${customer.email}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Customer Name*
                </label>

                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) =>
                    setCustomerName(e.target.value)
                  }
                  placeholder="Juan Dela Cruz"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Phone
                </label>

                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) =>
                    setCustomerPhone(e.target.value)
                  }
                  placeholder="09171234567"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Email
                </label>

                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) =>
                    setCustomerEmail(e.target.value)
                  }
                  placeholder="juan@example.com"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                />
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-400">
              Provide at least a phone number or an email.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500">
                Interested Vehicle
              </label>

              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
              >
                <option value="">
                  Not linked to a specific vehicle
                </option>

                {vehicles.map((vehicle) => (
                  <option
                    key={vehicle.id}
                    value={vehicle.id}
                  >
                    {vehicle.year} {vehicle.make}{" "}
                    {vehicle.model}
                    {vehicle.trim
                      ? ` ${vehicle.trim}`
                      : ""}{" "}
                    - {vehicle.vin}
                  </option>
                ))}
              </select>
            </div>

            {!vehicleId && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-500">
                  General Interest
                </label>

                <input
                  type="text"
                  value={interestNote}
                  onChange={(e) =>
                    setInterestNote(e.target.value)
                  }
                  placeholder="Looking for a sedan under PHP 1M"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                />
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Budget
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  value={budget}
                  onChange={(e) =>
                    setBudget(
                      formatNumberInput(e.target.value)
                    )
                  }
                  placeholder="1,000,000"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Financing Preference
                </label>

                <input
                  type="text"
                  value={financingPreference}
                  onChange={(e) =>
                    setFinancingPreference(e.target.value)
                  }
                  placeholder="Bank financing"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Follow-up Date
                </label>

                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) =>
                    setFollowUpDate(e.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500">
                Notes
              </label>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Prefers weekend viewing..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
              />
            </div>

            {formError && (
              <p className="mt-4 text-sm text-red-600">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {saving ? "Saving..." : "Save Lead"}
            </button>
          </form>
        )}

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Search Leads
              </label>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Customer, phone, email, VIN..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500">
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
              >
                <option value="ALL">All statuses</option>

                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500">
                Customer
              </label>

              <select
                value={customerFilter}
                onChange={(e) =>
                  setCustomerFilter(e.target.value)
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
              >
                <option value="ALL">All customers</option>

                {customers.map((customer) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6">
          {loading && (
            <p className="text-sm text-gray-500">
              Loading leads...
            </p>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-200 bg-white p-5">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && visibleLeads.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
              No leads found.
            </div>
          )}

          {!loading && !error && visibleLeads.length > 0 && (
            <div className="space-y-3">
              {visibleLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">
                          {lead.customer_name}
                        </p>

                        {lead.customer_id && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                            Customer linked
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-gray-500">
                        {lead.customer_phone && (
                          <>
                            {lead.customer_phone}
                            {" | "}
                          </>
                        )}

                        {lead.customer_email && (
                          <>
                            {lead.customer_email}
                            {" | "}
                          </>
                        )}

                        {new Date(
                          lead.created_at
                        ).toLocaleDateString("en-US")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {savingLeadId === lead.id && (
                        <span className="text-xs text-gray-400">
                          Saving...
                        </span>
                      )}

                      <select
                        value={lead.status}
                        onChange={(e) =>
                          handleStatusChange(
                            lead.id,
                            e.target.value
                          )
                        }
                        disabled={savingLeadId === lead.id}
                        className={`rounded-full border-0 px-3 py-1 text-xs font-semibold outline-none ${
                          STATUS_CLASSES[lead.status] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {STATUSES.map((status) => (
                          <option
                            key={status}
                            value={status}
                          >
                            {formatStatus(status)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-gray-600">
                    {lead.vehicle ? (
                      <p>
                        Interested in:{" "}
                        {lead.vehicle.year}{" "}
                        {lead.vehicle.make}{" "}
                        {lead.vehicle.model}
                        {lead.vehicle.trim
                          ? ` ${lead.vehicle.trim}`
                          : ""}{" "}
                        ({lead.vehicle.vin})
                      </p>
                    ) : lead.interest_note ? (
                      <p>
                        Interested in:{" "}
                        {lead.interest_note}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                    {lead.budget !== null && (
                      <span>
                        Budget:{" "}
                        {formatCurrency(lead.budget)}
                      </span>
                    )}

                    {lead.financing_preference && (
                      <span>
                        Financing:{" "}
                        {lead.financing_preference}
                      </span>
                    )}

                    {lead.follow_up_date && (
                      <span>
                        Follow up:{" "}
                        {new Date(
                          `${lead.follow_up_date}T00:00:00`
                        ).toLocaleDateString("en-US")}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        startFollowUpEdit(lead)
                      }
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {lead.follow_up_date
                        ? "Edit Follow-up"
                        : "Add Follow-up"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        startNotesEdit(lead)
                      }
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {lead.notes
                        ? "Edit Notes"
                        : "Add Notes"}
                    </button>
                  </div>

                  {editingFollowUpId === lead.id && (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <label className="block text-xs font-medium text-gray-500">
                        Follow-up Date
                      </label>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <input
                          type="date"
                          value={editFollowUpDate}
                          onChange={(e) =>
                            setEditFollowUpDate(
                              e.target.value
                            )
                          }
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            saveFollowUp(lead.id)
                          }
                          disabled={
                            savingLeadId === lead.id
                          }
                          className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:bg-gray-300"
                        >
                          Save
                        </button>

                        <button
                          type="button"
                          onClick={cancelFollowUpEdit}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {editingNotesId === lead.id && (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <label className="block text-xs font-medium text-gray-500">
                        Lead Notes
                      </label>

                      <textarea
                        value={editNotes}
                        onChange={(e) =>
                          setEditNotes(e.target.value)
                        }
                        rows={3}
                        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                      />

                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            saveNotes(lead.id)
                          }
                          disabled={
                            savingLeadId === lead.id
                          }
                          className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:bg-gray-300"
                        >
                          Save
                        </button>

                        <button
                          type="button"
                          onClick={cancelNotesEdit}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {lead.notes && editingNotesId !== lead.id && (
                    <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                      {lead.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
