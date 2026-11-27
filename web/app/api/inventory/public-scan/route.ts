import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile, createSupabaseServerClient } from '@/lib/supabaseServer';
import { crawlInventory } from '@/lib/scraper/inventory-crawler';
import { scrapeDealerInspireInventory } from '@/lib/scraper/dealerinspire-scraper';
import { detectProvider } from '@/lib/integrations/provider-detection';
import { validateScrapeUrl } from '@/lib/scraper/url-security';
import { createScanRecord } from '@/lib/integrations/scan-records';
import type { VehiclePreview } from '@/lib/integrations/vehicle-types';
import { requireSaasAccess } from '@/lib/saas';
import type { RawScrapedVehicle, ScraperError } from '@/lib/types/scraper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PublicScanRequest {
  url: string;
  maxVehicles?: number;
}

interface VehiclePreviewResponse {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  stockNumber: string | null;
  price: number | null;
  mileage: number | null;
  sourceUrl: string | null;
  images: string[];
}

async function mapToVehiclePreview(
  scrapedVehicle: RawScrapedVehicle
): Promise<VehiclePreviewResponse> {
  let price: number | null = null;
  if (scrapedVehicle.priceText) {
    const cleanPrice = scrapedVehicle.priceText.replace(/[$,\s]/g, '');
    price = parseFloat(cleanPrice) || null;
  }

  let mileage: number | null = null;
  if (scrapedVehicle.mileageText) {
    const cleanMileage = scrapedVehicle.mileageText.replace(/[,km\s]/gi, '');
    mileage = parseFloat(cleanMileage) || null;
  }

  // Parse year from title (format: "2023 Toyota Camry")
  let year: number | null = null;
  const yearMatch = scrapedVehicle.title.match(/^(\d{4})\s+/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  // Parse make/model from title
  const titleWithoutYear = year ? scrapedVehicle.title.replace(/^\d{4}\s+/, '') : scrapedVehicle.title;
  const parts = titleWithoutYear.split(/\s+/);
  const make = parts.length > 0 ? parts[0] : null;
  const model = parts.length > 1 ? parts.slice(1).join(' ') : null;

  return {
    vin: scrapedVehicle.vin || '',
    year,
    make,
    model,
    trim: null,
    stockNumber: null,
    price,
    mileage,
    sourceUrl: scrapedVehicle.sourceUrl || null,
    images: scrapedVehicle.imageUrls || [],
  };
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const profile = await getCurrentUserProfile();
    
    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to scan inventory.' },
        { status: 401 }
      );
    }

    // Validate role
    if (!['admin', 'manager', 'salesperson'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only admins, managers, and salespersons can scan inventory.' },
        { status: 403 }
      );
    }

    // Check SaaS access
    const saasAccess = await requireSaasAccess();
    if (!saasAccess.ok) {
      return NextResponse.json(
        { error: saasAccess.error },
        { status: saasAccess.status }
      );
    }

    // Parse request body
    const body: unknown = await req.json();
    
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { url, maxVehicles = 100 } = body as PublicScanRequest;

    if (typeof url !== 'string' || !url.trim()) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const normalizedUrl = url.trim();

    // Validate maxVehicles
    if (typeof maxVehicles !== 'number' || maxVehicles < 1 || maxVehicles > 500) {
      return NextResponse.json(
        { error: 'maxVehicles must be between 1 and 500' },
        { status: 400 }
      );
    }

    // Validate URL with SSRF protection
    await validateScrapeUrl(normalizedUrl);

    // Detect provider
    const provider = detectProvider(normalizedUrl);

    console.log(`[Public Scan] Provider detected: ${provider.name}, supported: ${provider.supported}, public scan: ${provider.supportsPublicScan}`);

    // Check if provider supports public scanning
    if (!provider.supported) {
      return NextResponse.json(
        { 
          error: `Unsupported provider: ${provider.name}. This provider is not currently supported for inventory scanning.`,
          provider: provider.name,
          supported: false
        },
        { status: 400 }
      );
    }

    if (!provider.supportsPublicScan) {
      return NextResponse.json(
        { 
          error: `${provider.name} does not support public URL scanning. Please configure an integration with authorized API credentials.`,
          provider: provider.name,
          requiresIntegration: true
        },
        { status: 400 }
      );
    }

    // Route to appropriate scraper
    let scrapedVehicles: RawScrapedVehicle[] = [];
    let scrapeErrors: ScraperError[] = [];
    let scrapeComplete = false;
    let totalVehicles: number | null = null;
    let pagesFetched = 0;

    if (provider.name === 'DealerInspire') {
      // Use DealerInspire-specific scraper
      try {
        const result = await scrapeDealerInspireInventory(normalizedUrl, maxVehicles);
        scrapedVehicles = result.vehicles;
        scrapeErrors = result.errors;
        scrapeComplete = result.complete;
        pagesFetched = 1; // DealerInspire LLM doesn't report pages
        totalVehicles = scrapedVehicles.length;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'DealerInspire scan failed';
        
        if (errorMessage.includes('403') || errorMessage.includes('Cloudflare')) {
          return NextResponse.json(
            { 
              error: 'Access denied (HTTP 403). The DealerInspire website blocks automated access via Cloudflare protection. This provider requires a configured integration with authorized API credentials.',
              provider: provider.name,
              blocked: true,
              reason: 'cloudflare'
            },
            { status: 403 }
          );
        }
        
        if (errorMessage.includes('429') || errorMessage.includes('rate limited')) {
          return NextResponse.json(
            { 
              error: 'Rate limited (HTTP 429). The DealerInspire website has rate limited automated access. Please try again later.',
              provider: provider.name,
              blocked: true,
              reason: 'rate_limit'
            },
            { status: 429 }
          );
        }

        return NextResponse.json(
          { error: errorMessage },
          { status: 500 }
        );
      }
    } else {
      // Use generic inventory crawler
      try {
        const result = await crawlInventory(normalizedUrl, {
          maxVehicles,
          delayMs: 1000,
        });
        scrapedVehicles = result.vehicles;
        scrapeErrors = result.errors;
        scrapeComplete = result.complete;
        pagesFetched = 1; // Generic crawler doesn't report pages in return
        totalVehicles = scrapedVehicles.length;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Inventory scan failed';
        
        if (errorMessage.includes('403') || errorMessage.includes('Cloudflare')) {
          return NextResponse.json(
            { 
              error: 'Access denied (HTTP 403). The website blocks automated access. This provider may require a configured integration with authorized API credentials.',
              provider: provider.name,
              blocked: true,
              reason: 'cloudflare'
            },
            { status: 403 }
          );
        }
        
        if (errorMessage.includes('429') || errorMessage.includes('rate limited')) {
          return NextResponse.json(
            { 
              error: 'Rate limited (HTTP 429). The website has rate limited automated access. Please try again later.',
              provider: provider.name,
              blocked: true,
              reason: 'rate_limit'
            },
            { status: 429 }
          );
        }

        return NextResponse.json(
          { error: errorMessage },
          { status: 500 }
        );
      }
    }

    // Handle empty results
    if (scrapedVehicles.length === 0) {
      return NextResponse.json({
        success: true,
        provider: provider.name,
        vehicles: [],
        vehicleCount: 0,
        complete: false,
        pagesFetched,
        totalPages: null,
        error: 'No vehicles found. The inventory may be empty or inaccessible.',
        errors: scrapeErrors.map(e => e.error),
      });
    }

    // Map to vehicle preview format
    const previewVehicles: VehiclePreview[] = [];
    const invalidRecordCount: number[] = [0];
    const duplicateVinSet = new Set<string>();

    for (const scraped of scrapedVehicles) {
      if (!scraped.vin) {
        invalidRecordCount[0]++;
        continue;
      }

      const normalizedVin = scraped.vin.trim().toUpperCase();
      
      if (duplicateVinSet.has(normalizedVin)) {
        invalidRecordCount[0]++;
        continue;
      }

      duplicateVinSet.add(normalizedVin);
      
      const preview = await mapToVehiclePreview(scraped);
      previewVehicles.push(preview);
    }

    // STRICT COMPLETENESS VALIDATION
    // Do not mark scan complete if errors occurred or pagination incomplete
    const scanComplete = scrapeComplete && scrapeErrors.length === 0;
    
    // Block import if scan is incomplete
    const importBlocked = !scanComplete;
    const importBlockedReason = importBlocked 
      ? scrapeErrors.length > 0 
        ? `${scrapeErrors.length} error(s) occurred during scanning` 
        : 'Scan was incomplete - not all pages were loaded'
      : null;

    // Create scan record (graceful degradation if migration 0055 not applied)
    const scanId = await createScanRecord({
      provider: provider.name.toLowerCase().replace(/\s+/g, '_'),
      sourceUrl: normalizedUrl,
      integrationId: null,
      scanMethod: 'scrape',
      vehicles: previewVehicles,
      complete: scanComplete,
      allPagesLoaded: scanComplete,
      pagesFetched,
      totalPages: totalVehicles ? Math.ceil(totalVehicles / maxVehicles) : null,
    });

    return NextResponse.json({
      success: true,
      provider: provider.name,
      scanId,
      vehicles: previewVehicles,
      vehicleCount: previewVehicles.length,
      complete: scrapeComplete && scrapeErrors.length === 0,
      pagesFetched,
      totalPages: totalVehicles ? Math.ceil(totalVehicles / maxVehicles) : null,
      invalidRecordCount: invalidRecordCount[0],
      importBlocked,
      importBlockedReason,
      errors: scrapeErrors.map(e => e.error),
    });
  } catch (error) {
    console.error('Public scan error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false
      },
      { status: 500 }
    );
  }
}
