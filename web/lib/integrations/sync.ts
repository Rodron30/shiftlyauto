import type {
  Integration,
  IntegrationSyncResult,
} from "./types";
import { syncDms } from "./dms";
import { syncCrm } from "./crm";
import { syncInventory } from "./inventory";
import { syncDealerWebsite } from "./websites";
import { syncAccounting } from "./accounting";

export async function syncIntegration(
  integration: Integration
): Promise<IntegrationSyncResult> {
  switch (integration.integration_type) {
    case "DMS":
      return syncDms(integration);

    case "CRM":
      return syncCrm(integration);

    case "INVENTORY":
      return syncInventory(integration);

    case "DEALER_WEBSITE":
      return syncDealerWebsite(integration);

    case "ACCOUNTING":
      return syncAccounting(integration);

    default:
      return {
        status: "FAILED",
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        errorMessage: "Unsupported integration type.",
      };
  }
}
