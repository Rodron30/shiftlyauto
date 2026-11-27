import type {
  TriCityFeedPage,
  TriCityFeedResponse,
  TriCityFeedTransport,
} from "./tricitymits-feed";
import { TriCityHttpFeedTransport } from "./tricity-http-feed";

const DEFAULT_TRANSPORT: TriCityFeedTransport =
  new TriCityHttpFeedTransport();

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0
      ? value
      : null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value.trim().replace(/,/g, "");

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isSafeInteger(parsed) ? parsed : null;
}

function getTotalVehicles(payload: TriCityFeedResponse): number | null {
  return toNumber(payload.summary?.total_vehicles);
}

function getTotalPages(
  payload: TriCityFeedResponse,
  pageSize: number
): number | null {
  const explicitTotalPages = toNumber(
    payload.pagination?.total_pages
  );

  if (explicitTotalPages !== null) {
    return explicitTotalPages;
  }

  const totalVehicles = getTotalVehicles(payload);

  if (!totalVehicles || pageSize <= 0) {
    return null;
  }

  return Math.ceil(totalVehicles / pageSize);
}

export async function fetchTriCityInventory(
  endpoint: string,
  transport: TriCityFeedTransport = DEFAULT_TRANSPORT
): Promise<TriCityFeedResponse> {
  return transport.fetchInventory(endpoint);
}

export async function fetchTriCityInventoryPage(
  endpoint: string,
  page: number,
  pageSize: number,
  transport: TriCityFeedTransport = DEFAULT_TRANSPORT
): Promise<TriCityFeedPage> {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("Tri-City feed page must be a positive integer.");
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("Tri-City feed pageSize must be a positive integer.");
  }

  const payload = await transport.fetchInventory(endpoint);
  const results = Array.isArray(payload.results)
    ? payload.results
    : [];

  const totalVehicles = getTotalVehicles(payload);
  const totalPages = getTotalPages(payload, pageSize);

  const complete =
    totalPages !== null
      ? page >= totalPages
      : totalVehicles !== null
        ? results.length >= totalVehicles
        : false;

  return {
    results,
    totalVehicles,
    page,
    pageSize,
    totalPages,
    complete,
  };
}
