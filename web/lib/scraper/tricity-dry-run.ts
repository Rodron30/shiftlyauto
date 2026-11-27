import { reconcileTriCityInventory } from "./tricity-reconciliation";

export type TriCityVehicleRecord = {
  vin: string;
};

export type TriCityDryRunPlan = {
  create: string[];
  update: string[];
  unchanged: string[];
  remove: string[];
};

export function buildTriCityDryRunPlan(
  existing: TriCityVehicleRecord[],
  scraped: TriCityVehicleRecord[],
  scrapeComplete: boolean
): TriCityDryRunPlan {
  const existingVins = existing
    .map((vehicle) => vehicle.vin.trim().toUpperCase())
    .filter(Boolean);

  const scrapedVins = scraped
    .map((vehicle) => vehicle.vin.trim().toUpperCase())
    .filter(Boolean);

  const existingSet = new Set(existingVins);

  const create = scrapedVins.filter(
    (vin) => !existingSet.has(vin)
  );

  const update = scrapedVins.filter(
    (vin) => existingSet.has(vin)
  );

  const reconciliation = reconcileTriCityInventory(
    existingVins,
    scrapedVins,
    scrapeComplete
  );

  return {
    create: [...new Set(create)],
    update: [...new Set(update)],
    unchanged: [],
    remove: reconciliation.shouldMarkMissingAsRemoved
      ? reconciliation.missingVins
      : [],
  };
}
