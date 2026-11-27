export type TriCityReconciliationResult = {
  missingVins: string[];
  shouldMarkMissingAsRemoved: boolean;
};

export function reconcileTriCityInventory(
  existingVins: string[],
  scrapedVins: string[],
  scrapeComplete: boolean
): TriCityReconciliationResult {
  const existing = new Set(
    existingVins
      .map((vin) => vin.trim().toUpperCase())
      .filter(Boolean)
  );

  const scraped = new Set(
    scrapedVins
      .map((vin) => vin.trim().toUpperCase())
      .filter(Boolean)
  );

  const missingVins = [...existing].filter(
    (vin) => !scraped.has(vin)
  );

  return {
    missingVins,
    shouldMarkMissingAsRemoved:
      scrapeComplete && missingVins.length > 0,
  };
}
