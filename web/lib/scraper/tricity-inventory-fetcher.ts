import type { TriCityFeedTransport } from "./tricitymits-feed";
import { fetchTriCityInventoryPage } from "./tricity-inventory-client";

export type TriCityInventoryPageFetcher = (
  page: number,
  pageSize: number,
) => string;

export type TriCityCollectedInventory = {
  results: unknown[];
  totalVehicles: number | null;
  totalPages: number | null;
  pagesFetched: number;
  complete: boolean;
  invalidRecordCount: number;
};

function getVin(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const vin = (value as Record<string, unknown>).vin;

  return typeof vin === "string" && vin.trim()
    ? vin.trim().toUpperCase()
    : null;
}

export async function fetchAllTriCityInventory(
  buildEndpoint: TriCityInventoryPageFetcher,
  pageSize: number,
  maxVehicles: number,
  transport: TriCityFeedTransport,
): Promise<TriCityCollectedInventory> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("Tri-City pageSize must be a positive integer.");
  }

  if (!Number.isInteger(maxVehicles) || maxVehicles < 1) {
    throw new Error("Tri-City maxVehicles must be a positive integer.");
  }

  const uniqueVehicles = new Map<string, unknown>();
  const seenVins = new Set<string>();

  let totalVehicles: number | null = null;
  let totalPages: number | null = null;
  let pagesFetched = 0;
  let invalidRecordCount = 0;
  let maxVehiclesExceeded = false;
  let complete = false;
  let page = 1;

  while (true) {
    const endpoint = buildEndpoint(page, pageSize);

    let pageResult;

    try {
      pageResult = await fetchTriCityInventoryPage(
        endpoint,
        page,
        pageSize,
        transport,
      );
    } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);

        throw new Error(
          `Tri-City page ${page} fetch failed: ${message}`,
        );
      }

    pagesFetched += 1;

    if (pageResult.totalVehicles !== null) {
      totalVehicles = pageResult.totalVehicles;
    }

    if (pageResult.totalPages !== null) {
      totalPages = pageResult.totalPages;
    }

    // Invalid provider pagination metadata must never cause an endless loop
    // or allow an incomplete inventory sync to proceed.
    if (totalPages !== null && totalPages < 1) {
      return {
        results: [...uniqueVehicles.values()],
        totalVehicles,
        totalPages,
        pagesFetched,
        complete: false,
        invalidRecordCount,
      };
    }

    for (const vehicle of pageResult.results) {
      const vin = getVin(vehicle);

      if (!vin) {
        invalidRecordCount += 1;
        continue;
      }

      if (seenVins.has(vin)) {
        throw new Error(
          `Tri-City feed contains duplicate VIN ${vin}; sync aborted.`,
        );
      }

      seenVins.add(vin);

      if (uniqueVehicles.size < maxVehicles) {
        uniqueVehicles.set(vin, vehicle);
      } else {
        maxVehiclesExceeded = true;
      }
    }

    const expectedPages =
      totalVehicles !== null
        ? Math.ceil(totalVehicles / pageSize)
        : null;

    const pageMetadataConsistent =
      totalPages !== null &&
      expectedPages !== null &&
      totalPages === expectedPages;

    const reachedProviderEnd =
      totalPages !== null
        ? page >= totalPages
        : pageResult.results.length < pageSize;

    if (reachedProviderEnd) {
      complete =
        !maxVehiclesExceeded &&
        invalidRecordCount === 0 &&
        totalVehicles !== null &&
        totalPages !== null &&
        pageMetadataConsistent &&
        page >= totalPages &&
        uniqueVehicles.size === totalVehicles;

      break;
    }

    // Stop at the configured cap, but never call a partial scan complete.
    if (uniqueVehicles.size >= maxVehicles) {
      complete = false;
      break;
    }

    page += 1;
  }

  return {
    results: [...uniqueVehicles.values()],
    totalVehicles,
    totalPages,
    pagesFetched,
    complete,
    invalidRecordCount,
  };
}