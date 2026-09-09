import type {
  Integration,
  IntegrationSyncResult,
} from "./types";

export async function syncInventory(
  integration: Integration
): Promise<IntegrationSyncResult> {
  void integration;

  return {
    status: "SUCCESS",
    recordsProcessed: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsFailed: 0,
  };
}
