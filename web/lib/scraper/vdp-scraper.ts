// lib/scraper/vdp-scraper.ts
//
// Vehicle Detail Page (VDP) scraper.
// Extracts vehicle data from dealership VDPs using JSON-LD schema parsing
// with conservative text fallbacks.
//
// Never invents missing vehicle data - only extracts what's actually present.

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { RawScrapedVehicle } from "../types/scraper";
import { validateScrapeUrl } from "./url-security";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";


/**
 * Normalizes a URL relative to a base URL.
 * Handles both absolute and relative URLs.
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
 * Extracts text content from a Cheerio element, trimming whitespace.
 */
function extractText($elem: cheerio.Cheerio<AnyNode>): string | null {
  if (!$elem.length) return null;
  const text = $elem.text().trim();
  return text || null;
}

/**
 * Attempts to parse JSON-LD data from the page.
 * Supports arrays, @graph, and multiple JSON-LD blocks.
 */
function parseJsonLd($: cheerio.CheerioAPI): Record<string, unknown>[] {
  const schemas: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, elem) => {
    try {
      const jsonText = $(elem).html();
      if (!jsonText) return;

      const parsed = JSON.parse(jsonText);

      // Handle arrays
      if (Array.isArray(parsed)) {
        schemas.push(...parsed);
      }
      // Handle @graph
      else if (parsed["@graph"] && Array.isArray(parsed["@graph"])) {
        schemas.push(...parsed["@graph"]);
      }
      // Handle single object
      else {
        schemas.push(parsed);
      }
    } catch (error) {
      console.error("JSON-LD parse error:", error);
    }
  });

  return schemas;
}

/**
 * Finds a Vehicle/Car/Product schema from parsed JSON-LD.
 */
function findVehicleSchema(schemas: Record<string, unknown>[]): Record<string, unknown> | null {
  return (
    schemas.find(
      (schema) =>
        schema["@type"] === "Vehicle" ||
        schema["@type"] === "Car" ||
        schema["@type"] === "Product"
    ) || null
  );
}

/**
 * Extracts vehicle data from JSON-LD schema.
 */
function extractFromSchema(schema: Record<string, unknown>): Partial<RawScrapedVehicle> {
  const result: Partial<RawScrapedVehicle> = {};

  if (schema.name) {
    result.title = String(schema.name).trim();
  }

  if (schema.vehicleIdentificationNumber) {
    result.vin = String(schema.vehicleIdentificationNumber).trim().toUpperCase();
  }

  if (schema.offers && Array.isArray(schema.offers) && schema.offers[0]) {
    const offer = schema.offers[0];
    if (offer.price) {
      result.priceText = String(offer.price).trim();
    }
    if (offer.priceCurrency) {
      // Store currency separately, will be handled in transformer
    }
  }

  if (schema.mileageFromOdometer) {
    result.mileageText = String(schema.mileageFromOdometer).trim();
  }

  if (schema.vehicleEngine) {
    const engine = schema.vehicleEngine;
    if (typeof engine === "string") {
      result.engine = engine.trim();
    } else if (
      typeof engine === "object" &&
      engine !== null &&
      "name" in engine
    ) {
      result.engine = String(engine.name).trim();
    }
  }

  if (schema.vehicleTransmission) {
    const transmission = schema.vehicleTransmission;
    if (typeof transmission === "string") {
      result.transmission = transmission.trim();
    } else if (
      typeof transmission === "object" &&
      transmission !== null &&
      "name" in transmission
    ) {
      result.transmission = String(transmission.name).trim();
    }
  }

  if (schema.driveWheelConfiguration) {
    result.drivetrain = String(schema.driveWheelConfiguration).trim();
  }

  if (schema.color) {
    result.exteriorColor = String(schema.color).trim();
  }

  if (schema.vehicleInteriorColor) {
    result.interiorColor = String(schema.vehicleInteriorColor).trim();
  }

  if (schema.image && Array.isArray(schema.image)) {
    result.imageUrls = schema.image.map((img: string) => String(img).trim());
  } else if (schema.image) {
    result.imageUrls = [String(schema.image).trim()];
  }

  return result;
}

/**
 * Conservative text fallback extraction.
 * Used when JSON-LD is unavailable or incomplete.
 */
function extractFromText($: cheerio.CheerioAPI, baseUrl: string): Partial<RawScrapedVehicle> {
  const result: Partial<RawScrapedVehicle> = {};

  // Try to find title from common selectors
  const titleSelectors = [
    "h1.vehicle-title",
    "h1.vdp-title",
    "h1.inventory-title",
    "h1[data-testid='vehicle-title']",
    "h1.title",
    "h1",
  ];

  for (const selector of titleSelectors) {
    const text = extractText($(selector));
    if (text) {
      result.title = text;
      break;
    }
  }

  // Try to find VIN from common patterns
  const vinSelectors = [
    ".vin",
    "[data-vin]",
    ".vehicle-identification-number",
    "#vin",
    "[data-testid='vin-number']",
  ];

  for (const selector of vinSelectors) {
    const text = extractText($(selector));
    if (text && text.length === 17) {
      result.vin = text.toUpperCase();
      break;
    }
  }

  // Try to find price
  const priceSelectors = [
    ".price",
    ".vehicle-price",
    "[data-price]",
    ".pricing",
  ];

  for (const selector of priceSelectors) {
    const text = extractText($(selector));
    if (text) {
      result.priceText = text;
      break;
    }
  }

  // Try to find mileage
  const mileageSelectors = [
    ".mileage",
    ".odometer",
    "[data-mileage]",
    ".vehicle-mileage",
  ];

  for (const selector of mileageSelectors) {
    const text = extractText($(selector));
    if (text) {
      result.mileageText = text;
      break;
    }
  }

  // Collect images from common HTML, lazy-loading, responsive-image,
// metadata, and CSS background-image patterns.
  const imageSet = new Set<string>();
  const ignoredImagePattern =
    /(?:logo|favicon|sprite|placeholder|avatar|payment|social-icon|banner|background|pattern)/i;
  const imageExtensionPattern =
    /\.(?:jpe?g|png|webp|avif|gif|bmp)(?:$)/i;

  const addImageCandidate = (
    rawValue: string | undefined,
    allowExtensionless = false
  ) => {
    const raw = rawValue?.trim();
    if (!raw || /^(?:data:|blob:|javascript:|#)/i.test(raw)) return;

    try {
      const normalized = normalizeUrl(raw, baseUrl);
      const parsed = new URL(normalized);

      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return;
      }

      const pathAndQuery = `${parsed.pathname}${parsed.search}`;
      if (ignoredImagePattern.test(pathAndQuery)) return;

      // Some image CDNs use extensionless URLs or transformation endpoints.
      // Accept these only when discovered in an actual image-related attribute.
      if (
        !imageExtensionPattern.test(parsed.pathname) &&
        !allowExtensionless
      ) {
        return;
      }

      imageSet.add(normalized);
    } catch {
      // Ignore malformed or unsupported image candidates.
    }
  };

  const addSrcSet = (value: string | undefined) => {
    if (!value) return;

    for (const candidate of value.split(",")) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url) addImageCandidate(url, true);
    }
  };

  $("img").each((_, elem) => {
    const img = $(elem);
    const descriptiveText = [
      img.attr("alt"),
      img.attr("class"),
      img.attr("id"),
    ].filter(Boolean).join(" ");

    if (ignoredImagePattern.test(descriptiveText)) return;

    const width = Number(img.attr("width"));
    const height = Number(img.attr("height"));

    // Ignore obvious tiny UI icons, but keep images with unknown dimensions.
    if (
      (Number.isFinite(width) && width > 0 && width < 48) ||
      (Number.isFinite(height) && height > 0 && height < 48)
    ) {
      return;
    }

    [
      "src",
      "data-src",
      "data-lazy-src",
      "data-original",
      "data-original-src",
      "data-zoom-image",
      "data-image",
      "data-fancybox",
    ].forEach((attribute) => {
      addImageCandidate(img.attr(attribute), true);
    });

    addSrcSet(img.attr("srcset"));
    addSrcSet(img.attr("data-srcset"));
    addSrcSet(img.attr("data-lazy-srcset"));
  });

  $("source[srcset], source[data-srcset]").each((_, elem) => {
    const source = $(elem);
    addSrcSet(source.attr("srcset"));
    addSrcSet(source.attr("data-srcset"));
  });

  $('meta[property="og:image"], meta[name="twitter:image"]').each((_, elem) => {
    addImageCandidate($(elem).attr("content"), true);
  });

  // Discover image URLs used by inline CSS backgrounds.
  $("[style]").each((_, elem) => {
    const style = $(elem).attr("style") || "";
    const backgroundPattern = /url\(\s*["']?([^"'()]+)["']?\s*\)/gi;
    let match: RegExpExecArray | null;

    while ((match = backgroundPattern.exec(style)) !== null) {
      addImageCandidate(match[1], true);
    }
  });

  result.imageUrls = Array.from(imageSet);
  return result;
}

/**
 * Main VDP scraping function.
 * Fetches HTML, parses JSON-LD, and extracts vehicle data.
 */
export async function scrapeVdp(vdpUrl: string): Promise<RawScrapedVehicle | null> {
  try {
    // Validate URL
    const urlObj = new URL(vdpUrl);
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      throw new Error("Only HTTP/HTTPS protocols are supported");
    }

    // Validate destination with DNS-aware SSRF protection
    await validateScrapeUrl(vdpUrl);

    // Fetch HTML
    const response = await fetch(vdpUrl, {
      redirect: "error",
      headers: {
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try JSON-LD first
    const schemas = parseJsonLd($);
    const vehicleSchema = findVehicleSchema(schemas);

    let scrapedData: Partial<RawScrapedVehicle> = {};

    if (vehicleSchema) {
      scrapedData = extractFromSchema(vehicleSchema);
    }

    // Fallback to text extraction for missing fields
    const textData = extractFromText($, vdpUrl);
    scrapedData = { ...textData, ...scrapedData }; // Text data takes precedence

    // Ensure required fields
    if (!scrapedData.title) {
      scrapedData.title = urlObj.pathname.split("/").pop() || "Unknown Vehicle";
    }

    if (!scrapedData.imageUrls || scrapedData.imageUrls.length === 0) {
      scrapedData.imageUrls = [];
    }

    console.log(`🖼️ VDP extraction: ${scrapedData.imageUrls.length} images extracted from ${vdpUrl}`);

    if (!scrapedData.priceText) {
      scrapedData.priceText = "";
    }

    if (!scrapedData.mileageText) {
      scrapedData.mileageText = "";
    }

    // Normalize image URLs
    if (scrapedData.imageUrls) {
      scrapedData.imageUrls = scrapedData.imageUrls.map((url) =>
        normalizeUrl(url, vdpUrl)
      );
    }

    return {
      title: scrapedData.title,
      vin: scrapedData.vin,
      priceText: scrapedData.priceText,
      mileageText: scrapedData.mileageText,
      engine: scrapedData.engine,
      transmission: scrapedData.transmission,
      drivetrain: scrapedData.drivetrain,
      exteriorColor: scrapedData.exteriorColor,
      interiorColor: scrapedData.interiorColor,
      imageUrls: scrapedData.imageUrls,
      sourceUrl: vdpUrl,
    };
  } catch (error) {
    console.error(`VDP scrape error for ${vdpUrl}:`, error);
    return null;
  }
}


