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
];

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
 */
function extractVdpLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];

  $("a[href]").each((_, elem) => {
    const href = $(elem).attr("href");
    if (!href) return;

    // Normalize the URL
    const normalized = normalizeUrl(href, baseUrl);

    // Check if it looks like a VDP URL
    if (isVdpUrl(normalized)) {
      links.push(normalized);
    }
  });

  // Deduplicate links
  return [...new Set(links)];
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
  const opts = { ...DEFAULT_CRAWLER_OPTIONS, ...options };
  const errors: ScraperError[] = [];
  const vehicles: RawScrapedVehicle[] = [];

  try {
    // Validate URL
    const urlObj = new URL(listingPageUrl);
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      throw new Error("Only HTTP/HTTPS protocols are supported");
    }

    // Validate destination with DNS-aware SSRF protection
    await validateScrapeUrl(listingPageUrl);

    // Fetch listing page HTML
    const response = await fetch(listingPageUrl, {
      redirect: "error",
      headers: {
        "User-Agent": opts.userAgent || USER_AGENT,
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract VDP links
    const vdpLinks = extractVdpLinks(html, listingPageUrl);

    if (vdpLinks.length === 0) {
      console.warn("No VDP links found on listing page");
      return { vehicles, errors };
    }

    console.log(`Found ${vdpLinks.length} VDP links, scraping up to ${opts.maxVehicles}`);

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

    console.log(`Successfully scraped ${vehicles.length} vehicles`);
    return { vehicles, errors };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Inventory crawl error for ${listingPageUrl}:`, errorMessage);
    errors.push({
      url: listingPageUrl,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    return { vehicles, errors };
  }
}