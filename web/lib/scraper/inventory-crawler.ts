// lib/scraper/inventory-crawler.ts
//
// Inventory listing page crawler.
// Finds vehicle detail page links from dealership inventory listings
// and coordinates VDP scraping with rate limiting and error handling.

import * as cheerio from "cheerio";
import { scrapeVdp } from "./vdp-scraper";
import { validateScrapeUrl } from "./url-security";
import type { RawScrapedVehicle, CrawlerOptions, ScraperError } from "../types/scraper";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

const DEFAULT_CRAWLER_OPTIONS: CrawlerOptions = {
  maxVehicles: 10,
  delayMs: 1000,
  userAgent: USER_AGENT,
};

/**
 * Common VDP URL patterns found on dealership inventory pages.
 * These are conservative patterns to avoid picking up non-vehicle links.
 * The patterns are generic and should work across multiple dealership platforms.
 */
const VDP_PATTERNS = [
  /\/vehicle\//i,
  /\/inventory\/.*\/details/i,
  /\/inventory\/.*\/vehicle/i,
  /\/inventory\/vehicle-\d+\/.+/i, // For test fixtures like /inventory/vehicle-1/2023-toyota-camry
  /\/new-vehicles\/.*\/details/i,
  /\/used-vehicles\/.*\/details/i,
  /\/vehicle-details\//i,
  /\/vdp\//i,
  /\/details\//i,
  /\/inventory\/[a-z0-9-]+\/fwd-\d+d-[a-z]+-[a-z0-9]{17}\//i, // Generic inventory pattern with VIN
  /\/inventory\/[a-z0-9-]+-[a-z0-9]{17}\//i, // Generic VIN-based inventory pattern
  /[a-z0-9]{17}/i, // VIN-based URLs (very broad, used as fallback)
];

/**
 * Detects if a URL is a DealerInspire inventory page.
 */
function isDealerInspireInventory(url: string): boolean {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname.toLowerCase();
  return hostname.includes("dealerinspire.com");
}

/**
 * Discovers inventory records from DealerInspire's /llm/inventory/ endpoint.
 * This endpoint provides structured JSON data with VINs and VDP URLs.
 * Supports pagination to collect up to maxVehicles VIN/VDP pairs.
 */
async function discoverDealerInspireInventory(
  baseUrl: string,
  maxVehicles: number
): Promise<{ vinToVdpMap: Map<string, string>; totalRecords: number }> {
  console.log(`🏭 DealerInspire inventory discovery initiated for: ${baseUrl}, max: ${maxVehicles}`);

  try {
    const urlObj = new URL(baseUrl);
    const hostname = urlObj.hostname;
    const protocol = urlObj.protocol;

    // Determine inventory type from path
    const isNew = baseUrl.includes("/new-vehicles/") || baseUrl.includes("type=new");
    const inventoryType = isNew ? "new" : "used";

    const vinToVdpMap = new Map<string, string>();
    let totalRecords = 0;
    let pageNumber = 1;
    let hasMorePages = true;

    while (hasMorePages && vinToVdpMap.size < maxVehicles) {
      // Capture size before processing to detect progress
      const sizeBeforePage = vinToVdpMap.size;

      // Construct the LLM inventory endpoint URL with pagination
      const llmUrl = new URL(`${protocol}//${hostname}/llm/inventory/`);
      llmUrl.searchParams.set("type", inventoryType);
      if (pageNumber > 1) {
        llmUrl.searchParams.set("_p", pageNumber.toString());
      }
      const llmEndpoint = llmUrl.toString();

      console.log(`📡 Fetching DealerInspire LLM page ${pageNumber}: ${llmEndpoint}`);

      const response = await fetch(llmEndpoint, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });

      console.log(`📡 DealerInspire LLM Response page ${pageNumber}:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        contentType: response.headers.get("content-type"),
      });

      if (!response.ok) {
        throw new Error(`DealerInspire LLM endpoint returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      console.log(`📦 DealerInspire LLM data received page ${pageNumber}, type: ${Array.isArray(data) ? 'array' : typeof data}`);

      // The LLM endpoint typically returns an array of inventory records
      const records = Array.isArray(data) ? data : (data.inventory || data.vehicles || []);

      console.log(`📊 DealerInspire page ${pageNumber} records: ${records.length}`);

      if (records.length === 0) {
        console.log(`🏁 DealerInspire pagination stopped: No records on page ${pageNumber}`);
        hasMorePages = false;
        break;
      }

      let validPairsOnPage = 0;

      records.forEach((record: any, index: number) => {
        try {
          const vin = record.vin || record.VIN;
          const vdpUrl = record.url || record.view_full_listing || record.vdp_url || record.link;

          if (vin && vdpUrl) {
            // Normalize the VDP URL to be absolute
            const normalizedVdpUrl = vdpUrl.startsWith("http")
              ? vdpUrl
              : `${protocol}//${hostname}${vdpUrl}`;

            const normalizedVin = vin.toUpperCase();

            // Deduplicate by VIN (Map automatically handles this)
            if (!vinToVdpMap.has(normalizedVin)) {
              vinToVdpMap.set(normalizedVin, normalizedVdpUrl);
              validPairsOnPage++;

              if (vinToVdpMap.size <= 3) {
                console.log(`🔍 Sample DealerInspire record ${vinToVdpMap.size}:`, {
                  vin: normalizedVin,
                  vdpUrl: normalizedVdpUrl,
                  title: record.title || record.vehicle_title,
                });
              }
            }
          }
        } catch (e) {
          // Skip malformed records
        }
      });

      totalRecords += records.length;

      console.log(`📊 Page ${pageNumber} summary: ${records.length} records, ${validPairsOnPage} new VIN/VDP pairs, total collected: ${vinToVdpMap.size}/${maxVehicles}`);

      // Progress guard: stop if no new VIN/VDP pairs were discovered on this page
      if (validPairsOnPage === 0) {
        console.log(`🏁 DealerInspire pagination stopped: No new VIN/VDP pairs discovered on page ${pageNumber}`);
        hasMorePages = false;
        break;
      }

      // Check if we've collected enough vehicles
      if (vinToVdpMap.size >= maxVehicles) {
        console.log(`🏁 DealerInspire pagination stopped: Collected ${vinToVdpMap.size} VIN/VDP pairs (max: ${maxVehicles})`);
        hasMorePages = false;
        break;
      }

      pageNumber++;
    }

    console.log(`✅ DealerInspire discovery completed: ${vinToVdpMap.size} VIN/VDP pairs found across ${pageNumber - 1} pages, ${totalRecords} total records`);

    return { vinToVdpMap, totalRecords };
  } catch (error) {
    console.error(`❌ DealerInspire LLM discovery failed:`, error);
    throw error;
  }
}

/**
 * Normalizes a URL relative to a base URL and removes tracking parameters.
 */
function normalizeUrl(url: string, baseUrl: string): string {
  try {
    const urlObj = new URL(url, baseUrl);
    // Remove common tracking parameters
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
    ];
    trackingParams.forEach((param) => {
      urlObj.searchParams.delete(param);
    });
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Checks if a URL matches known VDP patterns.
 */
function isVdpUrl(url: string): boolean {
  return VDP_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Extracts VDP links from an inventory listing page.
 * Looks for vehicle URLs in multiple places: anchor tags, JSON-LD, embedded data, etc.
 */
function extractVdpLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  const vinRegex = /\b[A-HJ-NPR-Z0-9]{17}\b/g;

  // Method 1: Extract from anchor tags (traditional method)
  $("a[href]").each((_, elem) => {
    const href = $(elem).attr("href");
    if (!href) return;

    const normalized = normalizeUrl(href, baseUrl);

    // Check if it looks like a VDP URL
    if (isVdpUrl(normalized)) {
      links.push(normalized);
    }
  });

  // Method 2: Extract from JSON-LD structured data
  try {
    $('script[type="application/ld+json"]').each((_, elem) => {
      try {
        const jsonText = $(elem).html();
        if (!jsonText) return;

        const parsed = JSON.parse(jsonText);
        const schemas = Array.isArray(parsed) ? parsed : [parsed];

        schemas.forEach((schema: any) => {
          // Look for Vehicle/Car/Product schemas with URLs
          if (schema["@type"] === "Vehicle" || schema["@type"] === "Car" || schema["@type"] === "Product") {
            if (schema.url) {
              const normalized = normalizeUrl(schema.url, baseUrl);
              if (isVdpUrl(normalized)) {
                links.push(normalized);
              }
            }
            // Also check offers for vehicle URLs
            if (schema.offers && Array.isArray(schema.offers)) {
              schema.offers.forEach((offer: any) => {
                if (offer.url) {
                  const normalized = normalizeUrl(offer.url, baseUrl);
                  if (isVdpUrl(normalized)) {
                    links.push(normalized);
                  }
                }
              });
            }
          }
        });
      } catch (e) {
        // Invalid JSON, skip
      }
    });
  } catch (e) {
    // JSON-LD parsing failed, continue with other methods
  }

  // Method 3: Extract from data attributes and data-* properties
  $('[data-vin], [data-vehicle-url], [data-vehicle-id], [data-vdp-url]').each((_, elem) => {
    const $elem = $(elem);
    const vin = $elem.attr('data-vin');
    const vehicleUrl = $elem.attr('data-vehicle-url') || $elem.attr('data-vdp-url');

    if (vehicleUrl) {
      const normalized = normalizeUrl(vehicleUrl, baseUrl);
      if (isVdpUrl(normalized)) {
        links.push(normalized);
      }
    }

    // If we have a VIN but no URL, try to construct URL from page context
    if (vin && vin.length === 17) {
      // Look for nearby anchor with this VIN
      const $parent = $elem.closest('a[href]');
      if ($parent.length) {
        const href = $parent.attr('href');
        if (href) {
          const normalized = normalizeUrl(href, baseUrl);
          if (isVdpUrl(normalized)) {
            links.push(normalized);
          }
        }
      }
    }
  });

  // Method 4: Look for VINs in text and try to find associated URLs
  const textContent = $('body').text();
  const vinsFound = textContent.match(vinRegex) || [];

  if (vinsFound.length > 0) {
    // For each VIN found, try to find a nearby link
    const uniqueVins = Array.from(new Set(vinsFound.map((v) => v.toUpperCase())));

    uniqueVins.forEach((vin) => {
      // Search for this VIN in anchor text or nearby elements
      $(`a[href]:contains("${vin}")`).each((_, elem) => {
        const href = $(elem).attr('href');
        if (href) {
          const normalized = normalizeUrl(href, baseUrl);
          if (isVdpUrl(normalized)) {
            links.push(normalized);
          }
        }
      });

      // Also search for elements with this VIN in data attributes
      $(`[data-vin="${vin}"], [data-vin="${vin.toLowerCase()}"]`).each((_, elem) => {
        const $elem = $(elem);
        const $parent = $elem.closest('a[href]');
        if ($parent.length) {
          const href = $parent.attr('href');
          if (href) {
            const normalized = normalizeUrl(href, baseUrl);
            if (isVdpUrl(normalized)) {
              links.push(normalized);
            }
          }
        }
      });
    });
  }

  // Method 5: Look for inventory data in script tags (common pattern for client-side rendered sites)
  $('script').each((_, elem) => {
    try {
      const scriptContent = $(elem).html();
      if (!scriptContent) return;

      // Look for inventory data patterns in JavaScript
      const inventoryPatterns = [
        /inventory[^a-z0-9]*:\s*\[([^\]]+)\]/gi,
        /vehicles[^a-z0-9]*:\s*\[([^\]]+)\]/gi,
        /url["\s:]+["']([^"']+)["']/gi,
      ];

      inventoryPatterns.forEach((pattern) => {
        const matches = scriptContent.match(pattern) || [];
        matches.forEach((match) => {
          try {
            // Extract URL from the match
            const urlMatch = match.match(/https?:\/\/[^\s"'<>]+/i);
            if (urlMatch) {
              const normalized = normalizeUrl(urlMatch[0], baseUrl);
              if (isVdpUrl(normalized)) {
                links.push(normalized);
              }
            }
          } catch (e) {
            // Skip invalid matches
          }
        });
      });
    } catch (e) {
      // Script parsing failed, continue
    }
  });

  // Deduplicate links
  return Array.from(new Set(links));
}

/**
 * Delays execution for a specified number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main inventory crawler function.
 * Crawls a listing page, finds VDP links, and scrapes each vehicle.
 */
export async function crawlInventory(
  listingPageUrl: string,
  options: Partial<CrawlerOptions> = {}
): Promise<{ vehicles: RawScrapedVehicle[]; errors: ScraperError[] }> {
  console.log(`🕷️ crawlInventory function called: ${listingPageUrl}`);

  const opts = { ...DEFAULT_CRAWLER_OPTIONS, ...options };
  const errors: ScraperError[] = [];
  const vehicles: RawScrapedVehicle[] = [];

  console.log(`⚙️ Crawler options:`, {
    maxVehicles: opts.maxVehicles,
    delayMs: opts.delayMs,
    userAgent: opts.userAgent
  });

  try {
    // Validate URL
    const urlObj = new URL(listingPageUrl);
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      throw new Error("Only HTTP/HTTPS protocols are supported");
    }

    console.log(`✅ URL protocol validation passed`);

    // Validate destination with DNS-aware SSRF protection
    await validateScrapeUrl(listingPageUrl);

    console.log(`✅ SSRF validation passed`);

    // Check if this is a DealerInspire inventory page
    const isDealerInspire = isDealerInspireInventory(listingPageUrl);
    console.log(`🏭 Platform detection: ${isDealerInspire ? 'DealerInspire' : 'Generic'}`);

    let vdpLinks: string[] = [];

    if (isDealerInspire) {
      // Use DealerInspire's LLM endpoint for structured inventory discovery
      try {
        const { vinToVdpMap, totalRecords } = await discoverDealerInspireInventory(
          listingPageUrl,
          opts.maxVehicles
        );

        // Convert VIN-to-VDP map to array of VDP URLs
        vdpLinks = Array.from(vinToVdpMap.values());

        console.log(`🏭 DealerInspire discovery results:`, {
          totalRecords,
          vinVdpPairs: vinToVdpMap.size,
          maxVehicles: opts.maxVehicles,
          vdpLinksToScrape: vdpLinks.length
        });

        if (vdpLinks.length === 0) {
          console.warn("❌ BLOCKER: DealerInspire LLM endpoint returned no VDP URLs");
          return { vehicles, errors };
        }
      } catch (llmError) {
        console.error(`❌ DealerInspire LLM discovery failed, falling back to generic HTML scraping:`, llmError);
        // Fall through to generic HTML scraping
      }
    }

    // Generic HTML scraping (fallback or for non-DealerInspire sites)
    if (vdpLinks.length === 0) {
      console.log(`🌐 Starting generic HTML inventory page fetch: ${listingPageUrl}`);

      const response = await fetch(listingPageUrl, {
        redirect: "error",
        headers: {
          "User-Agent": opts.userAgent || USER_AGENT,
        },
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      console.log(`📡 HTTP Response:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        redirect: response.redirected,
        url: response.url,
        contentType: response.headers.get("content-type"),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      console.log(`📄 Content Analysis:`, {
        htmlLength: html.length,
        charset: response.headers.get("content-type"),
        encoding: response.headers.get("content-encoding"),
      });

      // HTML structure analysis
      const $ = cheerio.load(html);
      const anchorCount = $("a[href]").length;
      const scriptCount = $("script").length;
      const jsonLdCount = $('script[type="application/ld+json"]').length;
      const dataVinCount = $('[data-vin]').length;
      const dataVehicleUrlCount = $('[data-vehicle-url], [data-vdp-url]').length;

      console.log(`🔍 HTML Structure Analysis:`, {
        anchorCount,
        scriptCount,
        jsonLdCount,
        dataVinCount,
        dataVehicleUrlCount,
        title: $('title').text(),
        metaDescription: $('meta[name="description"]').attr('content'),
      });

      // Extract VDP links
      console.log(`🔎 Starting VDP URL extraction...`);
      vdpLinks = extractVdpLinks(html, listingPageUrl);

      console.log(`VDP Discovery Results:`, {
        totalLinks: vdpLinks.length,
        sampleLinks: vdpLinks.slice(0, 5),
        listingPageUrl
      });

      if (vdpLinks.length === 0) {
        console.warn("❌ BLOCKER: No VDP links found on listing page - check page structure");
        return { vehicles, errors };
      }
    }

    console.log(`✅ Discovery successful: ${vdpLinks.length} VDP links found, proceeding to scrape...`);

    // Scrape each VDP with rate limiting
    const linksToScrape = vdpLinks.slice(0, opts.maxVehicles);

    for (let i = 0; i < linksToScrape.length; i++) {
      const vdpUrl = linksToScrape[i];

      try {
        // Rate limiting delay between requests
        if (i > 0) {
          await delay(opts.delayMs);
        }

        console.log(`Scraping VDP ${i + 1}/${linksToScrape.length}: ${vdpUrl}`);

        const vehicle = await scrapeVdp(vdpUrl);

        if (vehicle) {
          vehicles.push(vehicle);
        } else {
          errors.push({
            url: vdpUrl,
            error: "Failed to extract vehicle data",
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`Error scraping VDP ${vdpUrl}:`, errorMessage);
        errors.push({
          url: vdpUrl,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
      }
    }

    console.log(`✅ crawlInventory completed: ${vehicles.length} vehicles scraped, ${errors.length} errors`);
    return { vehicles, errors };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ crawlInventory error for ${listingPageUrl}:`, errorMessage);
    errors.push({
      url: listingPageUrl,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    return { vehicles, errors };
  }
}