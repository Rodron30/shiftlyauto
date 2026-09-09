"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";

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
      return "text-green-400";
    case "SYNCING":
      return "text-blue-400";
    case "ERROR":
      return "text-red-400";
    case "DISABLED":
      return "text-yellow-400";
    default:
      return "text-gray-400";
  }
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
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
    void loadData();
  }, []);

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
    <main className="min-h-screen bg-gray-950 text-white">
      <AppHeader />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Integrations
            </h1>

            <p className="mt-2 text-sm text-gray-400">
              Manage dealership connections for DMS, CRM,
              inventory, dealer websites, and accounting.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500"
          >
            Add Integration
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-lg border border-green-800 bg-green-950/40 px-4 py-3 text-sm text-green-300">
            {message}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={saveIntegration}
            className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {editingId
                    ? "Edit Integration"
                    : "Add Integration"}
                </h2>

                <p className="mt-1 text-sm text-gray-400">
                  Configure the integration connection.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-gray-300">
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
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm"
                >
                  {TYPES.map((item) => (
                    <option key={item} value={item}>
                      {TYPE_LABELS[item]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-gray-300">
                  Provider
                </span>

                <select
                  value={provider}
                  onChange={(event) =>
                    setProvider(event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm"
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
                <span className="mb-2 block text-sm text-gray-300">
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
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-gray-300">
                  Sync Direction
                </span>

                <select
                  value={syncDirection}
                  onChange={(event) =>
                    setSyncDirection(
                      event.target.value as SyncDirection
                    )
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm"
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

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-gray-300">
                Configuration JSON
              </span>

              <textarea
                value={configText}
                onChange={(event) =>
                  setConfigText(event.target.value)
                }
                rows={7}
                spellCheck={false}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-3 font-mono text-xs outline-none focus:border-blue-500"
              />

              <span className="mt-2 block text-xs text-gray-500">
                Connection settings are stored server-side and
                are not returned by the integrations list API.
              </span>
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm hover:bg-gray-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center text-sm text-gray-400">
            Loading integrations...
          </div>
        ) : integrations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-10 text-center">
            <h2 className="text-lg font-semibold">
              No integrations configured
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              Add your first DMS, CRM, inventory, dealer
              website, or accounting integration.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {integrations.map((integration) => (
              <section
                key={integration.id}
                className="rounded-xl border border-gray-800 bg-gray-900 p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold">
                        {integration.name}
                      </h2>

                      <span
                        className={`text-xs font-semibold ${statusClass(
                          integration.status
                        )}`}
                      >
                        {STATUS_LABELS[
                          integration.status
                        ]}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-gray-400">
                      {TYPE_LABELS[
                        integration.integration_type
                      ]}{" "}
                      / {integration.provider}
                    </p>
                  </div>

                  <span className="rounded-md border border-gray-700 px-2.5 py-1 text-xs text-gray-400">
                    {integration.sync_direction}
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-lg bg-gray-950 p-4">
                    <div className="text-xs text-gray-500">
                      Last Sync
                    </div>

                    <div className="mt-1 text-gray-200">
                      {formatDate(
                        integration.last_sync_at
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-gray-950 p-4">
                    <div className="text-xs text-gray-500">
                      Created
                    </div>

                    <div className="mt-1 text-gray-200">
                      {formatDate(
                        integration.created_at
                      )}
                    </div>
                  </div>
                </div>

                {integration.last_error && (
                  <div className="mt-4 rounded-lg border border-red-900 bg-red-950/30 p-3 text-xs text-red-300">
                    {integration.last_error}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-2">
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
                    className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="rounded-lg border border-gray-700 px-4 py-2 text-sm hover:bg-gray-800"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      deleteIntegration(integration)
                    }
                    className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 hover:bg-red-950/40"
                  >
                    Delete
                  </button>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
