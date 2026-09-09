import type {
  IntegrationProvider,
  IntegrationType,
} from "./types";

export const INTEGRATION_TYPES: IntegrationType[] = [
  "DMS",
  "CRM",
  "INVENTORY",
  "DEALER_WEBSITE",
  "ACCOUNTING",
];

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  {
    id: "generic-dms",
    name: "Generic DMS",
    type: "DMS",
    description: "Dealer management system integration.",
    available: true,
  },
  {
    id: "generic-crm",
    name: "Generic CRM",
    type: "CRM",
    description: "Customer relationship management integration.",
    available: true,
  },
  {
    id: "generic-inventory",
    name: "Generic Inventory Platform",
    type: "INVENTORY",
    description: "External inventory platform integration.",
    available: true,
  },
  {
    id: "generic-dealer-website",
    name: "Generic Dealer Website",
    type: "DEALER_WEBSITE",
    description: "Dealer website inventory and lead integration.",
    available: true,
  },
  {
    id: "generic-accounting",
    name: "Generic Accounting",
    type: "ACCOUNTING",
    description: "Accounting system integration.",
    available: true,
  },
];

export function getIntegrationProviders(
  type?: IntegrationType
): IntegrationProvider[] {
  if (!type) {
    return INTEGRATION_PROVIDERS;
  }

  return INTEGRATION_PROVIDERS.filter(
    (provider) => provider.type === type
  );
}

export function getIntegrationProvider(
  providerId: string
): IntegrationProvider | null {
  return (
    INTEGRATION_PROVIDERS.find(
      (provider) => provider.id === providerId
    ) ?? null
  );
}
