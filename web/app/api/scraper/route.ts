import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

import { requireSaasAccess, getSaasLimit, getSaasLimitError } from "@/lib/saas";
import { checkRateLimit, getRateLimitKey } from "@/lib/rateLimit";

import { crawlInventory } from "@/lib/scraper/inventory-crawler";
import { transformBatchToShiftlyVehicles } from "@/lib/scraper/transformer";
import type { RawScrapedVehicle, ScrapedVehiclePreview } from "@/lib/types/scraper";

// Security: Maximum vehicles that can be scraped in a single request
const MAX_VEHICLES_HARD_LIMIT = 50;

// Security: Safe dealership domain patterns
// In production, this should be configured per dealership or via allowlist
const SAFE_DOMAIN_PATTERNS = [
  /\.com$/i,
  /\.ca$/i,
  /\.net$/i,
  /\.org$/i,
  /\.co$/i,
  /\.io$/i,
];

/**
 * Validates that a URL is safe for scraping.
 * Prevents SSRF attacks by blocking internal networks and unsafe protocols.
 */
function validateScrapeUrl(url: string): { valid: boolean; error?: string } {
  try {
    const urlObj = new URL(url);

    // Only allow HTTP/HTTPS
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
    }

    // Block localhost and loopback
    const hostname = urlObj.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.startsWith("127.")
    ) {
      return { valid: false, error: "Localhost addresses are not allowed" };
    }

    // Block private IP ranges
    if (
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      (hostname.startsWith("172.") && parseInt(hostname.split(".")[1], 10) >= 16 && parseInt(hostname.split(".")[1], 10) <= 31)
    ) {
      return { valid: false, error: "Private IP addresses are not allowed" };
    }

    // Block link-local addresses
    if (hostname.startsWith("169.254.")) {
      return { valid: false, error: "Link-local addresses are not allowed" };
    }

    // Require a public domain (basic check)
    const hasValidDomain = SAFE_DOMAIN_PATTERNS.some((pattern) =>
      pattern.test(hostname)
    );
    if (!hasValidDomain) {
      return { valid: false, error: "Domain must be a public dealership website" };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid URL format",
    };
  }
}

export async function POST(request: Request) {
  try {
    // 1. Authentication
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        {
          success: false,
          error: "You must be signed in to use the scraper.",
        },
        { status: 401 }
      );
    }

    // 2. Rate limiting
    const rateLimitKey = getRateLimitKey(request, profile.id);
    const rateLimitResult = checkRateLimit(rateLimitKey, 5, 60000); // 5 requests per minute

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please wait before trying again.",
        },
        { status: 429 }
      );
    }

    // 3. Parse request body
    let body: { listingPageUrl?: string; maxVehicles?: number };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON body.",
        },
        { status: 400 }
      );
    }

    const { listingPageUrl, maxVehicles = 10 } = body;

    // 4. Validate required fields
    if (!listingPageUrl || typeof listingPageUrl !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "listingPageUrl is required and must be a string.",
        },
        { status: 400 }
      );
    }

    // 5. Validate URL security
    const urlValidation = validateScrapeUrl(listingPageUrl);
    if (!urlValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: urlValidation.error,
        },
        { status: 400 }
      );
    }

    // 6. Validate maxVehicles
    if (
      typeof maxVehicles !== "number" ||
      maxVehicles < 1 ||
      maxVehicles > MAX_VEHICLES_HARD_LIMIT
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `maxVehicles must be between 1 and ${MAX_VEHICLES_HARD_LIMIT}.`,
        },
        { status: 400 }
      );
    }

    // 7. SaaS access check
    const saasAccess = await requireSaasAccess();

    if (!saasAccess.ok) {
      return NextResponse.json(
        {
          success: false,
          error: saasAccess.error,
        },
        { status: saasAccess.status }
      );
    }

    // 8. SaaS vehicle limit check
    const vehicleLimit = getSaasLimit(saasAccess.context.plan, "vehicles");

    if (vehicleLimit !== null && maxVehicles > vehicleLimit) {
      return NextResponse.json(
        {
          success: false,
          error: `Requested ${maxVehicles} vehicles exceeds your plan limit of ${vehicleLimit}.`,
        },
        { status: 403 }
      );
    }

    // 9. Perform scraping
    console.log(`Starting scrape for ${listingPageUrl} with max ${maxVehicles} vehicles`);

    const { vehicles: scrapedVehicles, errors: scrapeErrors } =
      await crawlInventory(listingPageUrl, {
        maxVehicles,
        delayMs: 1000, // 1 second delay between requests
      });

    console.log(`Scrape completed: ${scrapedVehicles.length} vehicles, ${scrapeErrors.length} errors`);

    // 10. Transform to Shiftly vehicle format (for preview)
    const transformedVehicles = await transformBatchToShiftlyVehicles(
      scrapedVehicles,
      profile.dealership_id,
      profile.id
    );

    // 11. Build response
    const preview: ScrapedVehiclePreview = {
      vehicles: scrapedVehicles, // Return raw scraped data for preview
      totalFound: scrapedVehicles.length,
      totalProcessed: scrapedVehicles.length,
      errors: scrapeErrors.map((e) => e.error),
      sourceUrl: listingPageUrl,
    };

    return NextResponse.json(
      {
        success: true,
        preview,
        transformed: transformedVehicles, // Also include transformed format for preview
        scrapeErrors,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Scraper API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error during scraping.",
      },
      { status: 500 }
    );
  }
}