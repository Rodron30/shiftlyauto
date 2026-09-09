export type IntegrationType =
  | "DMS"
  | "CRM"
  | "INVENTORY"
  | "DEALER_WEBSITE"
  | "ACCOUNTING";

export type IntegrationStatus =
  | "DISCONNECTED"
  | "CONNECTED"
  | "SYNCING"
  | "ERROR"
  | "DISABLED";

export type SyncDirection =
  | "IMPORT"
  | "EXPORT"
  | "TWO_WAY";

export type SyncType =
  | "IMPORT"
  | "EXPORT"
  | "TWO_WAY"
  | "MANUAL"
  | "SCHEDULED";

export type SyncStatus =
  | "STARTED"
  | "SUCCESS"
  | "PARTIAL"
  | "FAILED";

export type Integration = {
  id: string;
  dealership_id: string;
  integration_type: IntegrationType;
  provider: string;
  name: string;
  status: IntegrationStatus;
  sync_direction: SyncDirection;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationSyncLog = {
  id: string;
  integration_id: string;
  dealership_id: string;
  sync_type: SyncType;
  status: SyncStatus;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type IntegrationProvider = {
  id: string;
  name: string;
  type: IntegrationType;
  description: string;
  available: boolean;
};

export type IntegrationSyncResult = {
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errorMessage?: string;
};
