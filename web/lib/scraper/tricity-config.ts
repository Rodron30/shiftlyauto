export type TriCityInventoryConfig = {
  provider: "convertus";
  inventoryId: string;
  feedUrl: string;
  dealershipId: string;
  enabled: boolean;
  syncIntervalMinutes: number;
  transport: "authorized_feed";
  pageSize: number;
  maxVehicles: number;
};
