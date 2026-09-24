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
  console.log(`🔀 syncIntegration called: Type ${integration.integration_type}, ID ${integration.id}`);

  switch (integration.integration_type) {
    case "DMS":
      console.log(`📞 Calling syncDms for integration ${integration.id}`);
      return syncDms(integration);

    case "CRM":
      console.log(`👥 Calling syncCrm for integration ${integration.id}`);
      return syncCrm(integration);

    case "INVENTORY":
      console.log(`🚗 Calling syncInventory for integration ${integration.id}`);
      return syncInventory(integration);

    case "DEALER_WEBSITE":
      console.log(`🌐 Calling syncDealerWebsite for integration ${integration.id}`);
      return syncDealerWebsite(integration);

    case "ACCOUNTING":
      console.log(`💰 Calling syncAccounting for integration ${integration.id}`);
      return syncAccounting(integration);

    default:
      console.log(`❌ Unsupported integration type: ${integration.integration_type}`);
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
