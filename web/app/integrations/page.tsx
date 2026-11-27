"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BackIcon,
  IntegrationsIcon,
  RefreshIcon,
  CheckIcon,
  XIcon,
  PlusIcon,
  SaveIcon,
  EditIcon,
  TrashIcon,
  ClockIcon,
  ShieldIcon,
  SettingsIcon,
  ChevronDownIcon,
} from "@/components/icons";

type IntegrationType =
  "DMS" | "CRM" | "INVENTORY" | "DEALER_WEBSITE" | "ACCOUNTING";

type IntegrationStatus =
  "DISCONNECTED" | "CONNECTED" | "SYNCING" | "ERROR" | "DISABLED";

type SyncDirection = "IMPORT" | "EXPORT" | "TWO_WAY";

type Integration = {
  id: string;
  dealership_id: string;
  integration_type: IntegrationType;
  provider: string;
  name: string;
  status: IntegrationStatus;
  sync_direction: SyncDirection;
  last_sync_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Provider = {
  id: string;
  name: string;
  type: IntegrationType;
  description: string;
  available: boolean;
};

const TYPE_LABELS: Record<IntegrationType, string> = {
  DMS: "DMS",
  CRM: "CRM",
  INVENTORY: "Inventory",
  DEALER_WEBSITE: "Dealer Website",
  ACCOUNTING: "Accounting",
};

const STATUS_LABELS: Record<IntegrationStatus, string> = {
  DISCONNECTED: "Disconnected",
  CONNECTED: "Connected",
  SYNCING: "Syncing",
  ERROR: "Error",
  DISABLED: "Disabled",
};

const DIRECTIONS: SyncDirection[] = ["IMPORT", "EXPORT", "TWO_WAY"];

const TYPES: IntegrationType[] = [
  "DMS",
  "CRM",
  "INVENTORY",
  "DEALER_WEBSITE",
  "ACCOUNTING",
];

function formatDate(value: string | null) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

export default function IntegrationsPage() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingRole, setCheckingRole] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [type, setType] = useState<IntegrationType>("DMS");
  const [provider, setProvider] = useState("");
  const [name, setName] = useState("");
  const [syncDirection, setSyncDirection] = useState<SyncDirection>("TWO_WAY");

  const [configText, setConfigText] = useState("{}");

  const availableProviders = useMemo(
    () => providers.filter((item) => item.type === type && item.available),
    [providers, type],
  );

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

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/integrations", {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load integrations");
      }

      setIntegrations(data.integrations || []);
      setProviders(data.providers || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load integrations",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (checkingRole) return;
    setTimeout(() => { void loadData(); }, 0);
  }, [checkingRole]);

  useEffect(() => {
    if (!editingId && availableProviders.length > 0) {
      setTimeout(() => { setProvider(availableProviders[0].id); }, 0);
    }
  }, [availableProviders, editingId]);

  function resetForm() {
    setEditingId(null);
    setType("DMS");
    setProvider("");
    setName("");
    setSyncDirection("TWO_WAY");
    setConfigText("{}");
    setShowForm(false);
  }

  function openCreate() {
    setError("");
    setMessage("");
    setEditingId(null);
    setType("DMS");
    setName("");
    setSyncDirection("TWO_WAY");
    setConfigText("{}");

    const firstProvider = providers.find(
      (item) => item.type === "DMS" && item.available,
    );

    setProvider(firstProvider?.id || "");
    setShowForm(true);
  }

  function openEdit(integration: Integration) {
    setError("");
    setMessage("");
    setEditingId(integration.id);
    setType(integration.integration_type);
    setProvider(integration.provider);
    setName(integration.name);
    setSyncDirection(integration.sync_direction);
    setConfigText("{}");
    setShowForm(true);
  }

  async function saveIntegration(event: FormEvent) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      let config: Record<string, unknown> = {};

      if (configText.trim()) {
        try {
          const parsed = JSON.parse(configText);

          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Config must be a JSON object");
          }

          config = parsed;
        } catch {
          throw new Error("Config must contain valid JSON");
        }
      }

      const payload = {
        integration_type: type,
        provider,
        name: name.trim(),
        sync_direction: syncDirection,
        config,
      };

      const response = await fetch(
        editingId ? `/api/integrations/${editingId}` : "/api/integrations",
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save integration");
      }

      setMessage(editingId ? "Integration updated." : "Integration created.");

      resetForm();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save integration",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteIntegration(integration: Integration) {
    const confirmed = window.confirm(
      `Delete integration "${integration.name}"?`,
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/integrations/${integration.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to delete integration");
      }

      setMessage("Integration deleted.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete integration",
      );
    }
  }

  async function syncIntegration(integration: Integration) {
    if (syncingId) return;

    setSyncingId(integration.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/integrations/${integration.id}/sync`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sync_type: "MANUAL",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Integration sync failed");
      }

      const result = data.result;

      setMessage(
        `Sync completed: ${result.recordsProcessed} processed, ${result.recordsCreated} created, ${result.recordsUpdated} updated, ${result.recordsFailed} failed.`,
      );

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Integration sync failed");
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-6 sm:px-4 lg:px-5">
      {checkingRole && (
        <div className="flex items-center justify-center py-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
            <RefreshIcon className="h-5 w-5 animate-spin" />
          </span>
          <p className="ml-3 text-sm font-medium text-[#64748B]">
            Checking permissions...
          </p>
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
                      <IntegrationsIcon className="h-4 w-4" />
                    </span>

                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">
                      Integrations
                    </p>
                  </div>

                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                    Integrations
                  </h1>

                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#64748B]">
                    Connect Shiftly Auto with the services and platforms your
                    dealership uses.
                  </p>
                </div>

                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                  {!showForm && (
                    <button
                      type="button"
                      onClick={openCreate}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/20"
                    >
                      <PlusIcon className="h-4 w-4 shrink-0" />
                      Add Integration
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

          {message && (
            <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 shrink-0" />
                {message}
              </div>
            </div>
          )}

          {showForm && (
            <section className="mb-5 rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                  <SettingsIcon className="h-4 w-4" />
                </span>

                <div>
                  <h2 className="text-base font-bold text-[#102A56]">
                    {editingId ? "Edit Integration" : "Add Integration"}
                  </h2>

                  <p className="text-xs text-[#64748B]">
                    Configure the integration connection
                  </p>
                </div>
              </div>

              <form
                onSubmit={saveIntegration}
                className="mt-5 grid gap-4 md:grid-cols-2"
              >
                <div>
                  <label className="block text-sm font-semibold text-[#334155]">
                    Integration Type
                  </label>

                  <div className="relative mt-2">
                    <select
                      value={type}
                      onChange={(event) => {
                        const nextType = event.target.value as IntegrationType;
                        setType(nextType);
                        const firstProvider = providers.find(
                          (item) => item.type === nextType && item.available,
                        );
                        setProvider(firstProvider?.id || "");
                      }}
                      className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                    >
                      {TYPES.map((item) => (
                        <option key={item} value={item}>
                          {TYPE_LABELS[item]}
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
                    Provider
                  </label>

                  <div className="relative mt-2">
                    <select
                      value={provider}
                      onChange={(event) => setProvider(event.target.value)}
                      required
                      className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                    >
                      <option value="">Select provider</option>
                      {availableProviders.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
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
                    Integration Name
                  </label>

                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={120}
                    placeholder="Example: Main DMS"
                    className="mt-2 h-11 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#334155]">
                    Sync Direction
                  </label>

                  <div className="relative mt-2">
                    <select
                      value={syncDirection}
                      onChange={(event) =>
                        setSyncDirection(event.target.value as SyncDirection)
                      }
                      className="h-11 w-full appearance-none rounded-xl border border-[#DCE8F5] bg-white px-3.5 text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                    >
                      {DIRECTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item === "TWO_WAY"
                            ? "Two Way"
                            : item.charAt(0) + item.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                      <ChevronDownIcon className="h-4 w-4" />
                    </span>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-[#334155]">
                    Configuration JSON
                  </label>

                  <textarea
                    value={configText}
                    onChange={(event) => setConfigText(event.target.value)}
                    rows={3}
                    spellCheck={false}
                    className="mt-2 w-full rounded-xl border border-[#DCE8F5] bg-white px-3.5 py-2.5 font-mono text-sm text-[#102A56] outline-none transition-colors focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/10"
                  />

                  <p className="mt-1.5 text-xs text-[#64748B]">
                    Connection settings are stored server-side and are not
                    returned by the integrations list API.
                  </p>
                </div>

                <div className="md:col-span-2 flex items-end justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
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
                    {saving
                      ? "Saving..."
                      : editingId
                        ? "Save Changes"
                        : "Create Integration"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                <RefreshIcon className="h-5 w-5 animate-spin" />
              </span>
              <p className="ml-3 text-sm font-medium text-[#64748B]">
                Loading integrations...
              </p>
            </div>
          ) : integrations.length === 0 ? (
            <div className="rounded-2xl border border-[#DCE8F5] bg-white p-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                <IntegrationsIcon className="h-5 w-5" />
              </span>

              <h3 className="mt-4 text-base font-bold text-[#102A56]">
                No integrations configured
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
                Add your first DMS, CRM, inventory, dealer website, or
                accounting integration to start syncing your dealership data.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {integrations.map((integration) => (
                <section
                  key={integration.id}
                  className="rounded-2xl border border-[#DCE8F5] bg-white p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE8F5] bg-[#F5F9FD] text-[#1677FF]">
                          <IntegrationsIcon className="h-4 w-4" />
                        </span>

                        <h3 className="text-sm font-bold text-[#102A56]">
                          {integration.name}
                        </h3>
                      </div>

                      <p className="mt-1 text-xs text-[#64748B]">
                        {TYPE_LABELS[integration.integration_type]} /{" "}
                        {integration.provider}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        integration.status === "CONNECTED"
                          ? "border border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
                          : integration.status === "SYNCING"
                            ? "border border-[#FED7AA] bg-[#FFFBEB] text-[#92400E]"
                            : integration.status === "ERROR"
                              ? "border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
                              : integration.status === "DISABLED"
                                ? "border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
                                : "border border-[#CFE2F5] bg-[#F5F9FD] text-[#475569]"
                      }`}
                    >
                      {integration.status === "CONNECTED" ? (
                        <CheckIcon className="h-3 w-3" />
                      ) : integration.status === "SYNCING" ? (
                        <RefreshIcon className="h-3 w-3 animate-spin" />
                      ) : integration.status === "ERROR" ? (
                        <XIcon className="h-3 w-3" />
                      ) : integration.status === "DISABLED" ? (
                        <ShieldIcon className="h-3 w-3" />
                      ) : (
                        <ClockIcon className="h-3 w-3" />
                      )}
                      {STATUS_LABELS[integration.status]}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-3">
                      <div className="flex items-center gap-2 text-xs text-[#64748B]">
                        <ClockIcon className="h-3.5 w-3.5" />
                        Last Sync
                      </div>

                      <div className="mt-1 text-sm font-semibold text-[#102A56]">
                        {formatDate(integration.last_sync_at)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#DCE8F5] bg-[#F8FBFF] p-3">
                      <div className="flex items-center gap-2 text-xs text-[#64748B]">
                        <ClockIcon className="h-3.5 w-3.5" />
                        Created
                      </div>

                      <div className="mt-1 text-sm font-semibold text-[#102A56]">
                        {formatDate(integration.created_at)}
                      </div>
                    </div>
                  </div>

                  {integration.last_error && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                      <div className="flex items-center gap-2">
                        <XIcon className="h-4 w-4 shrink-0" />
                        {integration.last_error}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => syncIntegration(integration)}
                      disabled={
                        syncingId === integration.id ||
                        integration.status === "DISABLED"
                      }
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#1677FF] bg-[#1677FF] px-3 text-xs font-semibold text-white transition-colors hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1]"
                    >
                      <RefreshIcon
                        className={`h-3.5 w-3.5 ${
                          syncingId === integration.id ? "animate-spin" : ""
                        }`}
                      />
                      {syncingId === integration.id ? "Syncing..." : "Sync"}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEdit(integration)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#DCE8F5] bg-white px-3 text-xs font-semibold text-[#475569] transition-colors hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteIntegration(integration)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
