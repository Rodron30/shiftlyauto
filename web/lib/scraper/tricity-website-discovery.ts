import * as cheerio from "cheerio";
import { validateScrapeUrl } from "./url-security";

const TRI_CITY_INVENTORY_URL = "https://www.tricitymits.com/vehicles/";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type TriCityDiscoveryResult = {
  urls: string[];
  pagesFetched: number;
  complete: boolean;
  errors: string[];
};

function normalizeUrl(value: string, baseUrl: string): string | null {
  try {
    const url = new URL(value, baseUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.hash = "";

    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
    ];

    for (const param of trackingParams) {
      url.searchParams.delete(param);
    }

    return url.toString();
  } catch {
    return null;
  }
}

function isTriCityHost(url: URL): boolean {
  return (
    url.hostname === "www.tricitymits.com" ||
    url.hostname === "tricitymits.com"
  );
}

function looksLikeVehicleUrl(url: URL): boolean {
  const path = url.pathname.toLowerCase();

  if (!isTriCityHost(url)) {
    return false;
  }

  if (
    path === "/vehicles/" ||
    path === "/vehicles" ||
    path === "/vehicles/used/" ||
    path === "/vehicles/used"
  ) {
    return false;
  }

  if (
    path.includes("/new-vehicles/") ||
    path.includes("/used-vehicles/") ||
    path.includes("/certified-vehicles/")
  ) {
    return true;
  }

  if (
    path.startsWith("/vehicle/") ||
    path.startsWith("/vehicles/") ||
    path.includes("/new/") ||
    path.includes("/used/")
  ) {
    return true;
  }

  return false;
}

function looksLikeInventoryPage(url: URL): boolean {
  if (!isTriCityHost(url)) {
    return false;
  }

  const path = url.pathname.toLowerCase();

  return (
    path === "/vehicles/" ||
    path === "/vehicles" ||
    path === "/vehicles/used/" ||
    path === "/vehicles/used" ||
    path.includes("/vehicles/page/")
  );
}

function collectLinks(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): {
  vehicleUrls: string[];
  paginationUrls: string[];
} {
  const vehicleUrls = new Set<string>();
  const paginationUrls = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");

    if (!href) {
      return;
    }

    const normalized = normalizeUrl(href, baseUrl);

    if (!normalized) {
      return;
    }

    let url: URL;

    try {
      url = new URL(normalized);
    } catch {
      return;
    }

    if (looksLikeVehicleUrl(url)) {
      vehicleUrls.add(normalized);
      return;
    }

    if (looksLikeInventoryPage(url)) {
      paginationUrls.add(normalized);
    }
  });

  return {
    vehicleUrls: [...vehicleUrls],
    paginationUrls: [...paginationUrls],
  };
}

async function fetchInventoryPage(url: string): Promise<string> {
  await validateScrapeUrl(url);

  const response = await fetch(url, {
    redirect: "error",
    headers: {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(
      `Tri-City inventory request failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
}

function getNextPageUrl(
  $: cheerio.CheerioAPI,
  currentUrl: string,
): string | null {
  const selectors = [
    'a[rel="next"]',
    ".pagination a.next",
    ".pagination .next a",
    "a.next",
    "a[aria-label*='Next']",
    "a[title*='Next']",
  ];

  for (const selector of selectors) {
    const href = $(selector).first().attr("href");

    if (!href) {
      continue;
    }

    const normalized = normalizeUrl(href, currentUrl);

    if (!normalized) {
      continue;
    }

    try {
      const url = new URL(normalized);

      if (looksLikeInventoryPage(url)) {
        return normalized;
      }
    } catch {
      // Ignore malformed pagination URLs.
    }
  }

  return null;
}

export async function discoverTriCityVehicleUrls(
  startUrl: string = TRI_CITY_INVENTORY_URL,
  maxPages: number = 100,
): Promise<TriCityDiscoveryResult> {
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new Error("Tri-City maxPages must be a positive integer.");
  }

  const vehicleUrls = new Set<string>();
  const visitedPages = new Set<string>();
  const errors: string[] = [];

  let currentUrl = startUrl;
  let pagesFetched = 0;
  let complete = false;

  while (currentUrl && pagesFetched < maxPages) {
    if (visitedPages.has(currentUrl)) {
      complete = true;
      break;
    }

    visitedPages.add(currentUrl);

    try {
      const html = await fetchInventoryPage(currentUrl);
      pagesFetched += 1;

      const $ = cheerio.load(html);

      const links = collectLinks($, currentUrl);

      for (const vehicleUrl of links.vehicleUrls) {
        vehicleUrls.add(vehicleUrl);
      }

      const nextPage = getNextPageUrl($, currentUrl);

      if (!nextPage) {
        complete = true;
        break;
      }

      currentUrl = nextPage;
    } catch (error) {
      pagesFetched += 1;

      const message =
        error instanceof Error ? error.message : String(error);

      errors.push(`${currentUrl}: ${message}`);

      complete = false;
      break;
    }
  }

  if (pagesFetched >= maxPages && currentUrl) {
    complete = false;
  }

  return {
    urls: [...vehicleUrls],
    pagesFetched,
    complete,
    errors,
  };
}
