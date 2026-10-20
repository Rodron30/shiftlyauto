// lib/scraper/dealerinspire-scraper.ts
//
// DealerInspire-specific inventory scraper.
// Uses DealerInspire's structured data sources for reliable extraction.

import type { RawScrapedVehicle, ScraperError } from "../types/scraper";
import { validateScrapeUrl } from "./url-security";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

/**
 * Scrapes DealerInspire inventory using their structured data sources.
 * Uses the /llm/inventory/ endpoint for structured inventory discovery.
 * If the LLM endpoint fails (e.g., Cloudflare 403, timeout, malformed response),
 * the scraper returns an error and does NOT modify existing inventory status.
 * This prevents false SOLD markings from incomplete scrapes.
 */
export async function scrapeDealerInspireInventory(
  inventoryUrl: string,
  maxVehicles: number
): Promise<{ vehicles: RawScrapedVehicle[]; errors: ScraperError[]; complete: boolean }> {
  console.log(`DealerInspire scraper initiated: ${inventoryUrl}, max: ${maxVehicles}`);

  const errors: ScraperError[] = [];
  const vehicles: RawScrapedVehicle[] = [];

  try {
    await validateScrapeUrl(inventoryUrl);
    const urlObj = new URL(inventoryUrl);
    const hostname = urlObj.hostname;
    const protocol = urlObj.protocol;

    // Determine inventory type from path
    const isNew = inventoryUrl.includes("/new-vehicles/") || inventoryUrl.includes("type=new");
    const inventoryType = isNew ? "new" : "used";

    const vinToVdpMap = new Map<string, string>();
    let totalRecords = 0;
    let pageNumber = 1;
    let hasMorePages = true;
    let discoveryComplete = false;

    // Try to use DealerInspire's LLM endpoint for structured inventory discovery
    try {
      while (hasMorePages && vinToVdpMap.size < maxVehicles) {

        const llmUrl = new URL(`${protocol}//${hostname}/llm/inventory/`);
        llmUrl.searchParams.set("type", inventoryType);
        if (pageNumber > 1) {
          llmUrl.searchParams.set("_p", pageNumber.toString());
        }
        const llmEndpoint = llmUrl.toString();
        await validateScrapeUrl(llmEndpoint);

        console.log(`Fetching DealerInspire LLM page ${pageNumber}: ${llmEndpoint}`);

        const response = await fetch(llmEndpoint, {
        redirect: "error",
          headers: {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(15000),
        });

        console.log(`DealerInspire LLM Response page ${pageNumber}:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          contentType: response.headers.get("content-type"),
        });

        if (!response.ok) {
          const errorMessage = `DealerInspire LLM endpoint returned ${response.status} ${response.statusText}`;
          if (response.status === 403) {
            console.warn(`DealerInspire LLM endpoint blocked (HTTP 403) - likely Cloudflare protection`);
            throw new Error(`${errorMessage} (Cloudflare blocked request)`);
          } else if (response.status === 429) {
            console.warn(`DealerInspire LLM endpoint rate limited (HTTP 429)`);
            throw new Error(`${errorMessage} (Rate limited)`);
          } else {
            console.warn(`DealerInspire LLM endpoint returned ${response.status}`);
            throw new Error(errorMessage);
          }
        }

        let data;
        try {
          data = await response.json();
        } catch {
          console.error(`Failed to parse DealerInspire LLM response as JSON`);
          throw new Error(`DealerInspire LLM endpoint returned invalid JSON response`);
        }

        console.log(`DealerInspire LLM data received page ${pageNumber}, type: ${Array.isArray(data) ? 'array' : typeof data}`);

        const records = Array.isArray(data) ? data : (data.inventory || data.vehicles || []);

        console.log(`DealerInspire page ${pageNumber} records: ${records.length}`);

        if (records.length === 0) {
          console.log("DealerInspire pagination completed: no records on page " + pageNumber);
          hasMorePages = false;
          discoveryComplete = true;
          break;
        }

        let validPairsOnPage = 0;

        records.forEach((record: Record<string, unknown>) => {
          try {
            const vin = typeof record.vin === "string" ? record.vin : typeof record.VIN === "string" ? record.VIN : null;
            const vdpUrl = [record.url, record.view_full_listing, record.vdp_url, record.link].find((value): value is string => typeof value === "string");

            if (vin && vdpUrl) {
              const normalizedVdpUrl = vdpUrl.startsWith("http")
                ? vdpUrl
                : `${protocol}//${hostname}${vdpUrl}`;

              const normalizedVin = vin.toUpperCase();

              if (!vinToVdpMap.has(normalizedVin)) {
                vinToVdpMap.set(normalizedVin, normalizedVdpUrl);
                validPairsOnPage++;

                if (vinToVdpMap.size <= 3) {
                  console.log(`DealerInspire record ${vinToVdpMap.size}:`, {
                    vin: normalizedVin,
                    vdpUrl: normalizedVdpUrl,
                    title: record.title || record.vehicle_title,
                  });
                }
              }
            }
          } catch {
            // Skip malformed records
          }
        });

        totalRecords += records.length;

        console.log(`Page ${pageNumber} summary: ${records.length} records, ${validPairsOnPage} new VIN/VDP pairs, total collected: ${vinToVdpMap.size}/${maxVehicles}`);

        // A duplicate-only page is not proof that pagination has ended.
        // Continue requesting the next page.
        if (validPairsOnPage === 0) {
          console.log("DealerInspire pagination: page " + pageNumber + " contained no new VIN/VDP pairs; continuing");
        }

        // Reaching maxVehicles means the configured scrape limit was reached.
        // It is intentionally capped and therefore NOT a complete inventory discovery.
        if (vinToVdpMap.size >= maxVehicles) {
          console.log("DealerInspire pagination reached configured maxVehicles (" + maxVehicles + "); discovery intentionally capped");
          hasMorePages = false;
          discoveryComplete = false;
          break;
        }

        pageNumber++;
      }
      console.log(`DealerInspire LLM discovery finished: ${vinToVdpMap.size} VIN/VDP pairs found across ${pageNumber - 1} pages, ${totalRecords} total records, complete=${discoveryComplete}`);
    } catch (llmError) {
      const errorMessage = llmError instanceof Error ? llmError.message : "Unknown LLM discovery error";
      console.error(`DealerInspire LLM discovery failed:`, errorMessage);
      errors.push({
        url: inventoryUrl,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      // Return early with no vehicles - this is a critical failure
      // Do not attempt HTML fallback as it will likely fail for the same reasons
      return { vehicles, errors, complete: false };
    }

    if (vinToVdpMap.size === 0) {
      console.warn("DealerInspire LLM endpoint returned no VIN/VDP pairs");
      return { vehicles, errors, complete: false };
    }

    // Scrape each VDP to get complete vehicle data
    const vdpUrls = Array.from(vinToVdpMap.values()).slice(0, maxVehicles);

    console.log(`Starting VDP scraping for ${vdpUrls.length} vehicles`);

    for (let i = 0; i < vdpUrls.length; i++) {
      const vdpUrl = vdpUrls[i];

      try {
        // Rate limiting delay between requests
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`Scraping VDP ${i + 1}/${vdpUrls.length}: ${vdpUrl}`);

        const vehicle = await scrapeDealerInspireVdp(vdpUrl);

        if (vehicle) {
          vehicles.push(vehicle);
        } else {
          errors.push({
            url: vdpUrl,
            error: "Failed to extract vehicle data from VDP",
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

    console.log(`DealerInspire scraper completed: ${vehicles.length} vehicles scraped, ${errors.length} errors`);
    return { vehicles, errors, complete: discoveryComplete && errors.length === 0 };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`DealerInspire scraper error for ${inventoryUrl}:`, errorMessage);
    errors.push({
      url: inventoryUrl,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    return { vehicles, errors, complete: false };
  }
}

/**
 * Scrapes a single DealerInspire VDP page.
 * Extracts complete vehicle data including all available images.
 */
async function scrapeDealerInspireVdp(vdpUrl: string): Promise<RawScrapedVehicle | null> {
  console.log(`Scraping DealerInspire VDP: ${vdpUrl}`);

  try {
    await validateScrapeUrl(vdpUrl);
    const response = await fetch(vdpUrl, {
    redirect: "error",
      headers: {
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract VIN from page
    const vinMatch = html.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
    const vin = vinMatch ? vinMatch[0].toUpperCase() : null;

    if (!vin) {
      console.warn(`No VIN found in VDP: ${vdpUrl}`);
      return null;
    }

    // Extract vehicle title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Parse year, make, model from title
    const titleParts = title.match(/(\d{4})\s+([A-Za-z]+)\s+([A-Za-z0-9\s]+)/);
    const year = titleParts ? parseInt(titleParts[1]) : null;
    const make = titleParts ? titleParts[2] : null;
    const model = titleParts ? titleParts[3].trim() : null;

    // Extract images
    const images = extractDealerInspireImages(html, vdpUrl);

    // Extract price
    const priceMatch = html.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, "")) : null;

    // Extract mileage
    const mileageMatch = html.match(/(\d+[\d,]*)\s*(mi|km|miles?)/i);
    const mileage = mileageMatch ? parseInt(mileageMatch[1].replace(/,/g, "")) : null;
    const mileageUnit = mileageMatch ? /km/i.test(mileageMatch[2]) ? "KM" : "MI" : null;

    const vehicle: RawScrapedVehicle = {
      title: title || `${year || ''} ${make || ''} ${model || ''}`.trim(),
      vin,
      priceText: price ? `$${price.toLocaleString()}` : '',
      mileageText: mileage ? `${mileage.toLocaleString()} ${mileageUnit || ''}` : '',
      engine: undefined,
      transmission: undefined,
      drivetrain: undefined,
      exteriorColor: undefined,
      interiorColor: undefined,
      imageUrls: images,
      sourceUrl: vdpUrl,
    };

    console.log(`Extracted vehicle: VIN ${vin}, images: ${images.length}`);
    return vehicle;
  } catch (error) {
    console.error(`Error scraping VDP ${vdpUrl}:`, error);
    return null;
  }
}

/**
 * Extracts all available images from a DealerInspire VDP page.
 * Uses multiple strategies to find image URLs.
 */
function extractDealerInspireImages(html: string, baseUrl: string): string[] {
  const candidates: string[] = [];
  const urlObj = new URL(baseUrl);
  const origin = urlObj.origin;

  const addCandidate = (raw: unknown) => {
    if (typeof raw !== "string") return;

    const value = raw
      .trim()
      .replace(/&amp;/gi, "&")
      .replace(/\\u0026/g, "&")
      .replace(/\\u002F/gi, "/")
      .replace(/\\\//g, "/")
      .replace(/^['"]|['"]$/g, "");

    if (!value) return;
    if (
      value.startsWith("data:") ||
      value.startsWith("blob:") ||
      value.startsWith("#")
    ) {
      return;
    }

    try {
      const absolute = new URL(value, origin).toString();

      const lower = absolute.toLowerCase();

      if (
        lower.includes("logo") ||
        lower.includes("favicon") ||
        lower.includes("icon") ||
        lower.includes("sprite") ||
        lower.includes("placeholder")
      ) {
        return;
      }

      const pathname = new URL(absolute).pathname.toLowerCase();

      const looksLikeImage =
        /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(pathname) ||
        /\/(image|images|photo|photos|vehicle|vehicles|inventory|media)\//i.test(
          pathname
        );

      if (looksLikeImage) {
        candidates.push(absolute);
      }
    } catch {
      // Ignore malformed URLs.
    }
  };

  // Strategy 1:
  // Common lazy-loading image attributes.
  const attributePatterns = [
    /data-src=["']([^"']+)["']/gi,
    /data-lazy-src=["']([^"']+)["']/gi,
    /data-original=["']([^"']+)["']/gi,
    /data-image=["']([^"']+)["']/gi,
    /data-image-url=["']([^"']+)["']/gi,
    /data-photo=["']([^"']+)["']/gi,
    /data-photo-url=["']([^"']+)["']/gi,
  ];

  for (const pattern of attributePatterns) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html)) !== null) {
      addCandidate(match[1]);
    }
  }

  // Strategy 2:
  // Normal <img src=""> attributes.
  const imgSrcPattern = /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi;

  let imgMatch: RegExpExecArray | null;

  while ((imgMatch = imgSrcPattern.exec(html)) !== null) {
    addCandidate(imgMatch[1]);
  }

  // Strategy 3:
  // srcset / data-srcset. Prefer the largest candidate when possible.
  const srcsetPatterns = [
    /\bsrcset=["']([^"']+)["']/gi,
    /\bdata-srcset=["']([^"']+)["']/gi,
  ];

  for (const pattern of srcsetPatterns) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html)) !== null) {
      const entries = match[1]
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      for (const entry of entries) {
        const parts = entry.split(/\s+/);
        addCandidate(parts[0]);
      }
    }
  }

  // Strategy 4:
  // JSON-LD structured data.
  const jsonLdPattern =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let jsonLdMatch: RegExpExecArray | null;

  while ((jsonLdMatch = jsonLdPattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(jsonLdMatch[1]);
      const queue: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

      while (queue.length > 0) {
        const item = queue.shift();

        if (!item || typeof item !== "object") {
          continue;
        }

        const record = item as Record<string, unknown>;

        if (record.image) {
          if (typeof record.image === "string") {
            addCandidate(record.image);
          } else if (Array.isArray(record.image)) {
            for (const image of record.image) {
              addCandidate(image);
            }
          } else if (
            typeof record.image === "object" &&
            record.image !== null
          ) {
            const imageObject = record.image as Record<string, unknown>;
            addCandidate(imageObject.url);
            addCandidate(imageObject.contentUrl);
          }
        }

        for (const value of Object.values(record)) {
          if (Array.isArray(value)) {
            queue.push(...value);
          } else if (value && typeof value === "object") {
            queue.push(value);
          }
        }
      }
    } catch {
      // Invalid JSON-LD; continue with other strategies.
    }
  }

  // Strategy 5:
  // Extract URLs embedded inside JavaScript/state objects.
  //
  // This is intentionally broad but still restricted to image-like URLs.
  const quotedUrlPattern =
    /["'`](https?:\/\/[^"'`\\\s]+|\/[^"'`\\\s]+)["'`]/gi;

  let quotedMatch: RegExpExecArray | null;

  while ((quotedMatch = quotedUrlPattern.exec(html)) !== null) {
    addCandidate(quotedMatch[1]);
  }

  // Strategy 6:
  // Look specifically for common DealerInspire/media URL patterns
  // even when the URL is not attached to a normal <img> element.
  const imageUrlPattern =
    /(?:https?:)?\/\/[^"'\\\s<>]+(?:jpg|jpeg|png|webp|gif|avif)(?:\?[^"'\\\s<>]*)?/gi;

  let directMatch: RegExpExecArray | null;

  while ((directMatch = imageUrlPattern.exec(html)) !== null) {
    addCandidate(directMatch[0]);
  }

  // Deduplicate while preserving discovery order.
  const uniqueImages: string[] = [];
  const seen = new Set<string>();

  for (const image of candidates) {
    try {
      const normalized = new URL(image).toString();

      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueImages.push(normalized);
      }
    } catch {
      // Ignore malformed URLs.
    }
  }

  console.log(
    `DealerInspire image extraction: ${uniqueImages.length} unique image URLs`
  );

  if (uniqueImages.length > 0) {
    console.log("Sample image URLs:", uniqueImages.slice(0, 5));
  }

  return uniqueImages;
}
