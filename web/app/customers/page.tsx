"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PlusIcon, SearchIcon, XIcon, SaveIcon, EditIcon, TrashIcon, CrmIcon } from "@/components/icons";
import { PageHeader } from "@/components/ui/PageHeader";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
};

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  notes: string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null);

  const [form, setForm] = useState<CustomerForm>({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

  const loadCustomers = useCallback(async (searchValue = search) => {
    try {
      setLoading(true);
      setError(null);

      const query = searchValue.trim()
        ? `?search=${encodeURIComponent(searchValue.trim())}`
        : "";

      const response = await fetch(`/api/customers${query}`, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load customers");
      }

      setCustomers(data.customers ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load customers"
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    async function initializeCustomers() {
      await loadCustomers("");
    }

    void initializeCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    async function checkRole() {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();
        setUserRole(data.profile?.role || null);
          setUserId(data.profile?.id || null);
      } catch (err) {
        console.error("Failed to check user role:", err);
      }
    }
    checkRole();
  }, []);

  function resetForm() {
    setForm({
      name: "",
      phone: "",
      email: "",
      notes: "",
    });

    setEditingCustomer(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(customer: Customer) {
    setEditingCustomer(customer);

    setForm({
      name: customer.name ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      notes: customer.notes ?? "",
    });

    setShowForm(true);
  }

  async function saveCustomer(event: FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const endpoint = editingCustomer
        ? `/api/customers/${editingCustomer.id}`
        : "/api/customers";

      const method = editingCustomer ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            (editingCustomer
              ? "Unable to update customer"
              : "Unable to create customer")
        );
      }

      setShowForm(false);
      resetForm();

      await loadCustomers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save customer"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer(customer: Customer) {
    const confirmed = window.confirm(
      `Delete customer "${customer.name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(
        `/api/customers/${customer.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to delete customer"
        );
      }

      await loadCustomers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete customer"
      );
    }
  }

  function formatDate(value: string) {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-7 pt-0 sm:px-4 lg:px-5">
      <PageHeader
        eyebrow="Customer Management"
        title="Customers"
        description="Manage customer records and CRM relationships."
        backHref="/"
        backLabel="Back to Dashboard"
        icon={<CrmIcon className="h-5 w-5" />}
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/20"
          >
            <PlusIcon className="h-4 w-4 shrink-0" />
            Add Customer
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm leading-5 text-[#B42318]">
          {error}
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <SearchIcon className="h-4 w-4 text-[#1677FF]" />
          <h2 className="text-sm font-bold text-[#102A56]">
            Search Customers
          </h2>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                loadCustomers(search);
              }
            }}
            placeholder="Search name, phone, or email..."
            className="h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-all placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10 sm:max-w-[420px]"
          />

          <button
            type="button"
            onClick={() => loadCustomers(search)}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#1E3A5F] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF] hover:text-[#1677FF] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/10"
          >
            <SearchIcon className="h-4 w-4 shrink-0" />
            Search
          </button>
        </div>
      </div>

      {showForm && userRole !== null && (
        <div className="mb-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                <CrmIcon className="h-5 w-5" />
              </span>

              <div>
                <h2 className="text-lg font-bold tracking-tight text-[#102A56]">
                  {editingCustomer ? "Edit Customer" : "New Customer"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#64748B]">
                  Customer name and at least one contact method are required.
                </p>
              </div>
            </div>
          </div>
          <form
  onSubmit={saveCustomer}
  className="grid grid-cols-1 gap-4 md:grid-cols-2"
>
  <div>
    <label className="mb-1.5 block text-xs font-medium text-[#475569]">
      Customer Name
    </label>
    <div className="relative">
      <CrmIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
      <input
        required
        value={form.name}
        onChange={(event) =>
          setForm({
            ...form,
            name: event.target.value,
          })
        }
        className="h-10 w-full rounded-lg border border-[#DCE8F5] bg-white pl-9 pr-3 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
        placeholder="Juan Dela Cruz"
      />
    </div>
  </div>

  <div>
    <label className="mb-1.5 block text-xs font-medium text-[#475569]">
      Phone
    </label>
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">
        ☎
      </span>
      <input
        value={form.phone}
        onChange={(event) =>
          setForm({
            ...form,
            phone: event.target.value,
          })
        }
        className="h-10 w-full rounded-lg border border-[#DCE8F5] bg-white pl-9 pr-3 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
        placeholder="09XXXXXXXXX"
      />
    </div>
  </div>

  <div>
    <label className="mb-1.5 block text-xs font-medium text-[#475569]">
      Email
    </label>
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">
        ✉
      </span>
      <input
        type="email"
        value={form.email}
        onChange={(event) =>
          setForm({
            ...form,
            email: event.target.value,
          })
        }
        className="h-10 w-full rounded-lg border border-[#DCE8F5] bg-white pl-9 pr-3 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
        placeholder="customer@example.com"
      />
    </div>
  </div>

  <div>
    <label className="mb-1.5 block text-xs font-medium text-[#475569]">
      Notes
    </label>
    <textarea
      value={form.notes}
      onChange={(event) => {
        const textarea = event.currentTarget;

        setForm({
          ...form,
          notes: textarea.value,
        });

        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      }}
      rows={1}
      className="min-h-10 w-full resize-none overflow-hidden rounded-lg border border-[#DCE8F5] bg-white px-3 py-2 text-sm leading-5 text-[#102A56] outline-none transition placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
      placeholder="Customer preferences, requirements, etc."
    />
  </div>

  <div className="flex items-center justify-end gap-2 md:col-span-2">
    <button
      type="button"
      onClick={() => {
        setShowForm(false);
        resetForm();
      }}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF] hover:text-[#1677FF] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/10"
    >
      <XIcon className="h-4 w-4 shrink-0" />
      Cancel
    </button>

    <button
      type="submit"
      disabled={saving}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <SaveIcon className="h-4 w-4 shrink-0" />
      {saving
        ? "Saving..."
        : editingCustomer
          ? "Save Changes"
          : "Create Customer"}
    </button>
  </div>
</form>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-[#DCE8F5] bg-white shadow-[0_4px_14px_rgba(30,64,175,0.06)]">
          {loading ? (
            <div className="p-3 text-center text-sm text-gray-500">
              Loading customers...
            </div>
          ) : customers.length === 0 ? (
            <div className="p-4 text-center">
              <h2 className="text-xs font-semibold text-gray-900">
                No customers found
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Add your first customer to start building your CRM.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#F8FBFF]">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Customer
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Phone
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Email
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Added
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="transition-colors hover:bg-[#F8FBFF]"
                    >
                      <td className="px-3 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {customer.name}
                        </div>

                        {customer.notes && (
                          <div className="mt-0.5 max-w-md truncate text-sm text-gray-500">
                            {customer.notes}
                          </div>
                        )}
                      </td>

                      <td className="px-2 py-2 text-sm text-gray-700">
                        {customer.phone || "-"}
                      </td>

                      <td className="px-2 py-2 text-sm text-gray-700">
                        {customer.email || "-"}
                      </td>

                      <td className="px-2 py-2 text-sm text-gray-500">
                        {formatDate(customer.created_at)}
                      </td>

                        <td className="px-2 py-2 text-right">
                          {(userRole !== "customer" || customer.created_by === userId) && (
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(customer)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-1.5 py-0.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                <EditIcon className="h-3 w-3" />
                                Edit
                              </button>
                              {userRole !== "customer" && (
                                <button
                                  type="button"
                                  onClick={() => deleteCustomer(customer)}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-1.5 py-0.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                                >
                                  <TrashIcon className="h-3 w-3" />
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  );
}

















