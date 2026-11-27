import type {
  Integration,
  IntegrationSyncResult,
} from "./types";
import { syncDms } from "./dms";
import { syncCrm } from "./crm";
import { syncInventory } from "./inventory";
import { syncDealerWebsite } from "./websites";
import { syncAccounting } from "./accounting";
import { syncTriCityInventory } from "@/lib/scraper/tricity-sync-service";

export async function syncIntegration(
  integration: Integration
): Promise<IntegrationSyncResult> {
  switch (integration.integration_type) {
    case "DMS":
      return syncDms(integration);

    case "CRM":
      return syncCrm(integration);

    case "INVENTORY":
      if (
        integration.provider.trim().toLowerCase() ===
        "tricity_mitsubishi"
      ) {
        const config = integration.config ?? {};

        const feedUrl =
          typeof config.feed_url === "string"
            ? config.feed_url.trim()
            : "";

        const rawPageSize = config.page_size ?? 50;
        const rawMaxVehicles = config.max_vehicles ?? 500;

        if (
          typeof rawPageSize !== "number" ||
          !Number.isInteger(rawPageSize) ||
          rawPageSize < 1 ||
          rawPageSize > 100
        ) {
          return {
            status: "FAILED",
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsFailed: 1,
            errorMessage: "Tri-City page_size must be an integer from 1 to 100.",
          };
        }

        if (
          typeof rawMaxVehicles !== "number" ||
          !Number.isInteger(rawMaxVehicles) ||
          rawMaxVehicles < 1 ||
          rawMaxVehicles > 500
        ) {
          return {
            status: "FAILED",
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsFailed: 1,
            errorMessage: "Tri-City max_vehicles must be an integer from 1 to 500.",
          };
        }

        const pageSize = rawPageSize;
        const maxVehicles = rawMaxVehicles;

        if (!feedUrl) {
          return {
            status: "FAILED",
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            errorMessage:
              "Tri-City authorized feed_url is not configured.",
          };
        }

        if (!integration.created_by) {
          return {
            status: "FAILED",
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            errorMessage:
              "Tri-City integration has no created_by user.",
          };
        }

        const result = await syncTriCityInventory(
          integration.dealership_id,
          integration.created_by,
          {
            feedUrl,
            pageSize,
            maxVehicles,
          },
        );

        return {
          status:
            !result.complete
              ? result.stats.created + result.stats.updated > 0
                ? "PARTIAL"
                : "FAILED"
              : result.stats.errors > 0
                ? result.stats.created + result.stats.updated > 0
                  ? "PARTIAL"
                  : "FAILED"
                : "SUCCESS",
          recordsProcessed: result.stats.fetched,
          recordsCreated: result.stats.created,
          recordsUpdated: result.stats.updated,
          recordsFailed: result.stats.errors,
          errorMessage:
            [
              !result.complete
                ? "Tri-City inventory scrape was incomplete; missing vehicles were not marked SOLD."
                : null,
              ...result.errors,
            ]
              .filter(Boolean)
              .join(" | ") || undefined,
        };
      }

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

