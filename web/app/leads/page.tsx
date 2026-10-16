"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  PlusIcon,
  SaveIcon,
  XIcon,
  EditIcon,
  BackIcon,
} from "@/components/icons";

type Vehicle = {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  currency: string | null;
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
  created_by: string | null;
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
    currency: string | null;
  } | null;
};

const STATUSES = ["NEW", "CONTACTED", "NEGOTIATING", "WON", "LOST"];

const STATUS_CLASSES: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-gray-100 text-amber-700",
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
  const currencyCode = "CAD";

  const localeMap: Record<string, string> = {
    USD: "en-US",
    PHP: "en-PH",
    EUR: "de-DE",
    GBP: "en-GB",
    CAD: "en-CA",
    AUD: "en-AU",
    JPY: "ja-JP",
    CNY: "zh-CN",
    SGD: "en-SG",
    HKD: "en-HK",
    MYR: "en-MY",
    THB: "th-TH",
    IDR: "id-ID",
    VND: "vi-VN",
  };

  const locale = localeMap[currencyCode] || "en-US";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showNewButton, setShowNewButton] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [vehicleId, setVehicleId] = useState("");
  const [interestNote, setInterestNote] = useState("");
  const [budget, setBudget] = useState("");
  const [financingPreference, setFinancingPreference] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);

  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(
    null,
  );

  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : "Failed to load leads.");
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
    setTimeout(() => { void loadLeads(); }, 0);
    setTimeout(() => { void loadCustomers(); }, 0);
    setTimeout(() => { void loadVehicles(); }, 0);
  }, []);

  useEffect(() => {
    async function checkRole() {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();
        const role = data.profile?.role || null;
        const canCreateLead = role !== null;
        setUserRole(role);
        setUserId(data.profile?.id || null);
        setShowNewButton(canCreateLead);
      } catch (err) {
        console.error("Failed to check user role:", err);
        setShowNewButton(false);
      }
    }
    checkRole();
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

    const parsedBudget = budget ? Number(budget.replace(/,/g, "")) : undefined;

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
          financingPreference: financingPreference || undefined,
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

      await Promise.all([loadLeads(), loadCustomers()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save lead.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    const previousLeads = leads;

    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, status: newStatus } : lead,
      ),
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
      setError(err instanceof Error ? err.message : "Failed to update status.");
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
        throw new Error(result.error || "Failed to update follow-up.");
      }

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                follow_up_date: editFollowUpDate || null,
              }
            : lead,
        ),
      );

      cancelFollowUpEdit();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update follow-up.",
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
        throw new Error(result.error || "Failed to update notes.");
      }

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                notes: editNotes.trim() || null,
              }
            : lead,
        ),
      );

      cancelNotesEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update notes.");
    } finally {
      setSavingLeadId(null);
    }
  };

  const visibleLeads = leads.filter((lead) => {
    const matchesStatus =
      statusFilter === "ALL" || lead.status === statusFilter;

    const matchesCustomer =
      customerFilter === "ALL" || lead.customer_id === customerFilter;

    const searchValue = search.trim().toLowerCase();

    const matchesSearch =
      !searchValue ||
      lead.customer_name.toLowerCase().includes(searchValue) ||
      (lead.customer_phone || "").toLowerCase().includes(searchValue) ||
      (lead.customer_email || "").toLowerCase().includes(searchValue) ||
      (lead.vehicle?.vin || "").toLowerCase().includes(searchValue) ||
      (lead.vehicle?.make || "").toLowerCase().includes(searchValue) ||
      (lead.vehicle?.model || "").toLowerCase().includes(searchValue);

    return matchesStatus && matchesCustomer && matchesSearch;
  });

  const statusCounts = leads.reduce(
    (acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                  <PlusIcon className="h-4 w-4" />
                </span>

                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">
                  Lead Management
                </p>
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                Leads
              </h1>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#64748B]">
                Track customer interest from first contact to sale.
              </p>
            </div>

            {showNewButton && (
              <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(true);
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/20"
                >
                  <PlusIcon className="h-4 w-4 shrink-0" />
                  New Lead
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STATUSES.map((status) => {
          const isActive = statusFilter === status;

          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`group rounded-2xl border bg-white p-4 text-left transition-colors hover:border-[#BFD8F2] ${
                isActive ? "border-[#1677FF] bg-[#F8FBFF]" : "border-[#DCE8F5]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                    isActive
                      ? "border-[#BFD8F2] bg-[#EAF4FF] text-[#1677FF]"
                      : "border-[#DCE8F5] bg-[#F5F9FD] text-[#64748B]"
                  }`}
                >
                  <PlusIcon className="h-4 w-4" />
                </span>

                <span className="text-2xl font-bold tracking-tight text-[#102A56]">
                  {statusCounts[status] || 0}
                </span>
              </div>

              <p className="mt-3 text-sm font-semibold text-[#334155]">
                {formatStatus(status)}
              </p>

              <p className="mt-1 text-xs text-[#64748B]">Lead status</p>
            </button>
          );
        })}
      </div>

      {showForm && userRole !== null && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                  <PlusIcon className="h-4 w-4" />
                </span>

                <div>
                  <h2 className="text-base font-bold text-[#102A56]">
                    New Lead
                  </h2>

                  <p className="mt-0.5 text-sm text-[#64748B]">
                    Link the lead to an existing customer or create a new
                    customer automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-4">
            <label className="block text-sm font-semibold text-[#334155]">
              Existing Customer
            </label>

            <select
              value={customerId}
              onChange={(e) => handleCustomerSelect(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
            >
              <option value="">New customer</option>

              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                  {customer.phone ? ` - ${customer.phone}` : ""}
                  {customer.email ? ` - ${customer.email}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-4">
            <label className="block text-sm font-semibold text-[#334155]">
              Interested Vehicle
            </label>

            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
            >
              <option value="">Not linked to a specific vehicle</option>

              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                  {vehicle.trim ? ` ${vehicle.trim}` : ""}
                  {" - "}
                  {vehicle.vin}
                  {vehicle.currency ? ` (${vehicle.currency})` : ""}
                </option>
              ))}
            </select>
          </div>

          {!vehicleId && (
            <div className="mt-4">
              <label className="block text-sm font-semibold text-[#334155]">
                General Interest
              </label>

              <input
                type="text"
                value={interestNote}
                onChange={(e) => setInterestNote(e.target.value)}
                placeholder="Looking for a sedan under $50,000"
                className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
              />
            </div>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-[#334155]">
                Budget
              </label>

              <input
                type="text"
                inputMode="numeric"
                value={budget}
                onChange={(e) => setBudget(formatNumberInput(e.target.value))}
                placeholder="50,000"
                className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#334155]">
                Financing Preference
              </label>

              <input
                type="text"
                value={financingPreference}
                onChange={(e) => setFinancingPreference(e.target.value)}
                placeholder="Bank financing"
                className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#334155]">
                Follow-up Date
              </label>

              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-[#334155]">
              Notes
            </label>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Prefers weekend viewing..."
              className="mt-2 w-full resize-y rounded-xl border border-[#DCE8F5] bg-white px-3.5 py-3 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
            />
          </div>

          {formError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
            >
              <XIcon className="h-4 w-4" />
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1]"
            >
              <SaveIcon className="h-4 w-4" />
              {saving ? "Saving..." : "Save Lead"}
            </button>
          </div>
        </form>
      )}

      <section className="mt-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
            <EditIcon className="h-4 w-4" />
          </span>

          <div>
            <h2 className="text-base font-bold text-[#102A56]">
              Search & Filters
            </h2>

            <p className="text-xs text-[#64748B]">
              Narrow leads by customer or current status.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-[#334155]">
              Search Leads
            </label>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer, phone, email, VIN..."
              className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#334155]">
              Status
            </label>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
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
            <label className="block text-sm font-semibold text-[#334155]">
              Customer
            </label>

            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
            >
              <option value="ALL">All customers</option>

              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="mt-5">
        {loading && (
          <div className="rounded-2xl border border-[#DCE8F5] bg-white p-8 text-center">
            <p className="text-sm font-medium text-[#64748B]">
              Loading leads...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-semibold text-red-700">
              Unable to load leads
            </p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
          </div>
        )}

        {!loading && !error && visibleLeads.length === 0 && (
          <div className="rounded-2xl border border-[#DCE8F5] bg-white p-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
              <PlusIcon className="h-5 w-5" />
            </span>

            <h3 className="mt-4 text-base font-bold text-[#102A56]">
              No leads found
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
              No leads match the current filters. Create a new lead or adjust
              your search criteria.
            </p>
          </div>
        )}

        {!loading && !error && visibleLeads.length > 0 && (
          <div className="space-y-4">
            {visibleLeads.map((lead) => (
              <article
                key={lead.id}
                className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5 transition-colors hover:border-[#BFD8F2]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-[#102A56]">
                        {lead.customer_name}
                      </h3>

                      {lead.customer_id && (
                        <span className="inline-flex items-center rounded-full border border-[#CFE2F5] bg-[#F5F9FD] px-2.5 py-1 text-xs font-semibold text-[#475569]">
                          Customer linked
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-[#64748B]">
                      {lead.customer_phone && (
                        <>
                          {lead.customer_phone}
                          {" · "}
                        </>
                      )}

                      {lead.customer_email && (
                        <>
                          {lead.customer_email}
                          {" · "}
                        </>
                      )}

                      {new Date(lead.created_at).toLocaleDateString("en-US")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {savingLeadId === lead.id && (
                      <span className="text-xs font-medium text-[#94A3B8]">
                        Saving...
                      </span>
                    )}

                    <select
                      value={lead.status}
                      onChange={(e) =>
                        handleStatusChange(lead.id, e.target.value)
                      }
                      disabled={savingLeadId === lead.id}
                      className={`h-9 rounded-xl border px-3 text-xs font-bold outline-none ${
                        STATUS_CLASSES[lead.status] ||
                        "border-[#DCE8F5] bg-[#F5F9FD] text-[#475569]"
                      }`}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {formatStatus(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {lead.vehicle ? (
                    <div className="rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-3.5">
                      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748B]">
                        Interested Vehicle
                      </p>

                      <p className="mt-1 text-sm font-semibold text-[#334155]">
                        {lead.vehicle.year} {lead.vehicle.make}{" "}
                        {lead.vehicle.model}
                        {lead.vehicle.trim ? ` ${lead.vehicle.trim}` : ""}
                      </p>

                      <p className="mt-1 text-xs text-[#64748B]">
                        VIN: {lead.vehicle.vin}
                      </p>
                    </div>
                  ) : lead.interest_note ? (
                    <div className="rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-3.5">
                      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748B]">
                        General Interest
                      </p>

                      <p className="mt-1 text-sm text-[#475569]">
                        {lead.interest_note}
                      </p>
                    </div>
                  ) : null}

                  {lead.budget !== null && (
                    <div className="rounded-xl border border-[#DCE8F5] bg-white p-3.5">
                      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748B]">
                        Budget
                      </p>

                      <p className="mt-1 text-sm font-semibold text-[#102A56]">
                        {formatCurrency(lead.budget)}
                      </p>
                    </div>
                  )}

                  {lead.financing_preference && (
                    <div className="rounded-xl border border-[#DCE8F5] bg-white p-3.5">
                      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748B]">
                        Financing
                      </p>

                      <p className="mt-1 text-sm font-semibold text-[#334155]">
                        {lead.financing_preference}
                      </p>
                    </div>
                  )}

                  {lead.follow_up_date && (
                    <div className="rounded-xl border border-[#DCE8F5] bg-white p-3.5">
                      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748B]">
                        Follow-up
                      </p>

                      <p className="mt-1 text-sm font-semibold text-[#334155]">
                        {new Date(
                          `${lead.follow_up_date}T00:00:00`,
                        ).toLocaleDateString("en-US")}
                      </p>
                    </div>
                  )}
                </div>

                {(userRole !== "customer" || lead.created_by === userId) && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[#E7EEF6] pt-4">
                    <button
                      type="button"
                      onClick={() => startFollowUpEdit(lead)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-3 text-xs font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                      {lead.follow_up_date ? "Edit Follow-up" : "Add Follow-up"}
                    </button>

                    <button
                      type="button"
                      onClick={() => startNotesEdit(lead)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-3 text-xs font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                      {lead.notes ? "Edit Notes" : "Add Notes"}
                    </button>
                  </div>
                )}

                {editingFollowUpId === lead.id && (
                  <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-4">
                    <label className="block text-sm font-semibold text-[#334155]">
                      Follow-up Date
                    </label>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        type="date"
                        value={editFollowUpDate}
                        onChange={(e) => setEditFollowUpDate(e.target.value)}
                        className="h-10 rounded-xl border border-[#DCE8F5] bg-white px-3 text-sm text-[#102A56] outline-none focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                      />

                      <button
                        type="button"
                        onClick={() => saveFollowUp(lead.id)}
                        disabled={savingLeadId === lead.id}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1677FF] px-4 text-sm font-semibold text-white hover:bg-[#0F67E8] disabled:bg-[#CBD5E1]"
                      >
                        <SaveIcon className="h-4 w-4" />
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={cancelFollowUpEdit}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] hover:bg-[#F8FBFF]"
                      >
                        <XIcon className="h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {editingNotesId === lead.id && (
                  <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-4">
                    <label className="block text-sm font-semibold text-[#334155]">
                      Lead Notes
                    </label>

                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={4}
                      className="mt-2 w-full resize-y rounded-xl border border-[#DCE8F5] bg-white px-3 py-3 text-sm text-[#102A56] outline-none focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => saveNotes(lead.id)}
                        disabled={savingLeadId === lead.id}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1677FF] px-4 text-sm font-semibold text-white hover:bg-[#0F67E8] disabled:bg-[#CBD5E1]"
                      >
                        <SaveIcon className="h-4 w-4" />
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={cancelNotesEdit}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] hover:bg-[#F8FBFF]"
                      >
                        <XIcon className="h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {lead.notes && editingNotesId !== lead.id && (
                  <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748B]">
                      Notes
                    </p>

                    <p className="mt-1.5 text-sm leading-6 text-[#475569]">
                      {lead.notes}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


