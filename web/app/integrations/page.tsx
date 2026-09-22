"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type IntegrationType =
  | "DMS"
  | "CRM"
  | "INVENTORY"
  | "DEALER_WEBSITE"
  | "ACCOUNTING";

type IntegrationStatus =
  | "DISCONNECTED"
  | "CONNECTED"
  | "SYNCING"
  | "ERROR"
  | "DISABLED";

type SyncDirection =
  | "IMPORT"
  | "EXPORT"
  | "TWO_WAY";

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

const DIRECTIONS: SyncDirection[] = [
  "IMPORT",
  "EXPORT",
  "TWO_WAY",
];

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

function statusClass(status: IntegrationStatus) {
  switch (status) {
    case "CONNECTED":
      return "text-green-700";
    case "SYNCING":
      return "text-blue-700";
    case "ERROR":
      return "text-red-700";
    case "DISABLED":
      return "text-yellow-700";
    default:
      return "text-neutral-600";
  }
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
  const [syncDirection, setSyncDirection] =
    useState<SyncDirection>("TWO_WAY");

  const [configText, setConfigText] = useState("{}");

  const availableProviders = useMemo(
    () =>
      providers.filter(
        (item) =>
          item.type === type &&
          item.available
      ),
    [providers, type]
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
        throw new Error(
          data.error || "Unable to load integrations"
        );
      }

      setIntegrations(data.integrations || []);
      setProviders(data.providers || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load integrations"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (checkingRole) return;
    void loadData();
  }, [checkingRole]);

  useEffect(() => {
    if (!editingId && availableProviders.length > 0) {
      setProvider(availableProviders[0].id);
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
      (item) =>
        item.type === "DMS" &&
        item.available
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

          if (
            !parsed ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)
          ) {
            throw new Error(
              "Config must be a JSON object"
            );
          }

          config = parsed;
        } catch {
          throw new Error(
            "Config must contain valid JSON"
          );
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
        editingId
          ? `/api/integrations/${editingId}`
          : "/api/integrations",
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to save integration"
        );
      }

      setMessage(
        editingId
          ? "Integration updated."
          : "Integration created."
      );

      resetForm();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save integration"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteIntegration(
    integration: Integration
  ) {
    const confirmed = window.confirm(
      `Delete integration "${integration.name}"?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/integrations/${integration.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to delete integration"
        );
      }

      setMessage("Integration deleted.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete integration"
      );
    }
  }

  async function syncIntegration(
    integration: Integration
  ) {
    if (syncingId) return;

    setSyncingId(integration.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/integrations/${integration.id}/sync`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sync_type: "MANUAL",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Integration sync failed"
        );
      }

      const result = data.result;

      setMessage(
        `Sync completed: ${result.recordsProcessed} processed, ${result.recordsCreated} created, ${result.recordsUpdated} updated, ${result.recordsFailed} failed.`
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Integration sync failed"
      );
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {checkingRole && (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-neutral-600">Checking permissions...</div>
        </div>
      )}

      {!checkingRole && (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">
                Integrations
              </h1>

              <p className="mt-1 text-xs text-neutral-600">
                Manage dealership connections for DMS, CRM,
                inventory, dealer websites, and accounting.
              </p>
              </div>

              <button
                type="button"
                onClick={openCreate}
                className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
              >
                Add Integration
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {message && (
              <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                {message}
              </div>
            )}

            {showForm && (
          <form
            onSubmit={saveIntegration}
            className="mb-6 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  {editingId
                    ? "Edit Integration"
                    : "Add Integration"}
                </h2>

                <p className="mt-1 text-xs text-neutral-600">
                  Configure the integration connection.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-neutral-600 hover:text-neutral-900"
              >
                Cancel
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-700">
                  Integration Type
                </span>

                <select
                  value={type}
                  onChange={(event) => {
                    const nextType =
                      event.target.value as IntegrationType;

                    setType(nextType);

                    const firstProvider =
                      providers.find(
                        (item) =>
                          item.type === nextType &&
                          item.available
                      );

                    setProvider(
                      firstProvider?.id || ""
                    );
                  }}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                >
                  {TYPES.map((item) => (
                    <option key={item} value={item}>
                      {TYPE_LABELS[item]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-700">
                  Provider
                </span>

                <select
                  value={provider}
                  onChange={(event) =>
                    setProvider(event.target.value)
                  }
                  required
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                >
                  <option value="">
                    Select provider
                  </option>

                  {availableProviders.map(
                    (item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-700">
                  Integration Name
                </span>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  required
                  maxLength={120}
                  placeholder="Example: Main DMS"
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-700">
                  Sync Direction
                </span>

                <select
                  value={syncDirection}
                  onChange={(event) =>
                    setSyncDirection(
                      event.target.value as SyncDirection
                    )
                  }
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                >
                  {DIRECTIONS.map((item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item === "TWO_WAY"
                        ? "Two Way"
                        : item.charAt(0) +
                          item.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-neutral-700">
                Configuration JSON
              </span>

              <textarea
                value={configText}
                onChange={(event) =>
                  setConfigText(event.target.value)
                }
                rows={5}
                spellCheck={false}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-[10px] focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
              />

              <span className="mt-1 block text-[10px] text-neutral-500">
                Connection settings are stored server-side and
                are not returned by the integrations list API.
              </span>
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Create Integration"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-xs text-neutral-500 shadow-sm">
            Loading integrations...
          </div>
        ) : integrations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <h2 className="text-xs font-semibold text-neutral-900">
              No integrations configured
            </h2>

            <p className="mt-2 text-xs text-neutral-600">
              Add your first DMS, CRM, inventory, dealer
              website, or accounting integration.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {integrations.map((integration) => (
              <section
                key={integration.id}
                className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-neutral-900">
                        {integration.name}
                      </h2>

                      <span
                        className={`text-[10px] font-semibold ${statusClass(
                          integration.status
                        )}`}
                      >
                        {STATUS_LABELS[
                          integration.status
                        ]}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-neutral-600">
                      {TYPE_LABELS[
                        integration.integration_type
                      ]}{" "}
                      / {integration.provider}
                    </p>
                  </div>

                  <span className="rounded-md border border-neutral-200 px-2 py-0.5 text-[10px] text-neutral-600">
                    {integration.sync_direction}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-md bg-neutral-50 p-2">
                    <div className="text-[10px] text-neutral-500">
                      Last Sync
                    </div>

                    <div className="mt-1 text-neutral-900">
                      {formatDate(
                        integration.last_sync_at
                      )}
                    </div>
                  </div>

                  <div className="rounded-md bg-neutral-50 p-2">
                    <div className="text-[10px] text-neutral-500">
                      Created
                    </div>

                    <div className="mt-1 text-neutral-900">
                      {formatDate(
                        integration.created_at
                      )}
                    </div>
                  </div>
                </div>

                {integration.last_error && (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-[10px] text-red-700">
                    {integration.last_error}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      syncIntegration(integration)
                    }
                    disabled={
                      syncingId === integration.id ||
                      integration.status ===
                        "DISABLED"
                    }
                    className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {syncingId === integration.id
                      ? "Syncing..."
                      : "Sync Now"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openEdit(integration)
                    }
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      deleteIntegration(integration)
                    }
                    className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                  >
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

