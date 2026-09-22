"use client";

import { FormEvent, useEffect, useState } from "react";

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

  async function loadCustomers(searchValue = search) {
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
  }

  useEffect(() => {
    loadCustomers("");
  }, []);

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
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            Customers
          </h1>
          <p className="mt-1 text-xs text-neutral-600">
            Manage customer records and CRM relationships.
          </p>
        </div>

        {true && (
            <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
          >
            + Add Customer
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
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
            className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
          />

          <button
            type="button"
            onClick={() => loadCustomers(search)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Search
          </button>
        </div>
      </div>

      {showForm && userRole !== null && (
        <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                {editingCustomer
                  ? "Edit Customer"
                  : "New Customer"}
              </h2>
              <p className="mt-1 text-xs text-neutral-600">
                Customer name and at least one contact method are
                required.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="text-xs text-neutral-600 hover:text-neutral-900"
            >
              Cancel
            </button>
          </div>

          <form
            onSubmit={saveCustomer}
            className="grid gap-3 md:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">
                Customer Name
              </label>
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
                }
                className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                placeholder="Juan Dela Cruz"
              />
            </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700">
                  Phone
                </label>
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      phone: event.target.value,
                    })
                  }
                  className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                  placeholder="09XXXXXXXXX"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      email: event.target.value,
                    })
                  }
                  className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                  placeholder="customer@example.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-neutral-700">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      notes: event.target.value,
                    })
                  }
                  rows={3}
                  className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                  placeholder="Customer preferences, requirements, etc."
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
                >
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

        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-6 text-center text-xs text-neutral-500">
              Loading customers...
            </div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center">
              <h2 className="text-xs font-semibold text-neutral-900">
                No customers found
              </h2>
              <p className="mt-2 text-xs text-neutral-600">
                Add your first customer to start building your CRM.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Customer
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Phone
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Email
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Added
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-200">
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-neutral-50"
                    >
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-neutral-900">
                          {customer.name}
                        </div>

                        {customer.notes && (
                          <div className="mt-0.5 max-w-md truncate text-[10px] text-neutral-500">
                            {customer.notes}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-neutral-700">
                        {customer.phone || "-"}
                      </td>

                      <td className="px-4 py-3 text-xs text-neutral-700">
                        {customer.email || "-"}
                      </td>

                      <td className="px-4 py-3 text-xs text-neutral-500">
                        {formatDate(customer.created_at)}
                      </td>

                        <td className="px-4 py-3 text-right">
                          {(userRole !== "customer" || customer.created_by === userId) && (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(customer)}
                                className="rounded-md border border-neutral-300 px-2 py-1 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50"
                              >
                                Edit
                              </button>
                              {userRole !== "customer" && (
                                <button
                                  type="button"
                                  onClick={() => deleteCustomer(customer)}
                                  className="rounded-md border border-red-300 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-50"
                                >
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

