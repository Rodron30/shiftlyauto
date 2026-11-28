import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile, createSupabaseServerClient } from '@/lib/supabaseServer';
import { createScanRecord } from '@/lib/integrations/scan-records';
import { requireSaasAccess } from '@/lib/saas';
import type { VehiclePreview } from '@/lib/integrations/vehicle-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExtensionScanRequest {
  provider: string;
  sourceUrl: string;
  vehicles: VehiclePreview[];
  complete: boolean;
  allPagesLoaded: boolean;
  pagesFetched: number;
  totalPages: number | null;
  failedPages?: number[];
  totalVehicles?: number;
}

/**
 * API endpoint for Chrome extension to register inventory scans.
 * 
 * This endpoint replaces the legacy direct import workflow. Instead of importing
 * immediately, the extension registers a scan record, which is then reviewed and
 * imported through the unified preview/import UI.
 * 
 * Security:
 * - Requires authenticated user with dealership
 * - Requires admin, manager, or salesperson role
 * - Requires active SaaS access
 * - Validates provider and source URL
 * - Validates vehicle count and VIN format
 * - Strict completeness validation (no count mismatch acceptance)
 * - Creates server-side scan record with 5-minute expiry
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const profile = await getCurrentUserProfile();
    
    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to register a scan.' },
        { status: 401 }
      );
    }

    // Validate role
    if (!['admin', 'manager', 'salesperson'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only admins, managers, and salespersons can register scans.' },
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

    const {
      provider,
      sourceUrl,
      vehicles,
      complete,
      allPagesLoaded,
      pagesFetched,
      totalPages,
      failedPages
    } = body as ExtensionScanRequest;

    // Validate provider
    if (typeof provider !== 'string' || !provider.trim()) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    // Validate source URL
    if (typeof sourceUrl !== 'string' || !sourceUrl.trim()) {
      return NextResponse.json(
        { error: 'Source URL is required' },
        { status: 400 }
      );
    }

    // Validate vehicles array
    if (!Array.isArray(vehicles)) {
      return NextResponse.json(
        { error: 'Vehicles must be an array' },
        { status: 400 }
      );
    }

    // Validate vehicle count
    if (vehicles.length === 0) {
      return NextResponse.json(
        { error: 'At least one vehicle is required' },
        { status: 400 }
      );
    }

    if (vehicles.length > 500) {
      return NextResponse.json(
        { error: 'Maximum 500 vehicles allowed per scan' },
        { status: 400 }
      );
    }

    // Validate pagination metadata
    if (typeof complete !== 'boolean') {
      return NextResponse.json(
        { error: 'Complete flag is required' },
        { status: 400 }
      );
    }

    if (typeof allPagesLoaded !== 'boolean') {
      return NextResponse.json(
        { error: 'All pages loaded flag is required' },
        { status: 400 }
      );
    }

    if (typeof pagesFetched !== 'number' || pagesFetched < 1) {
      return NextResponse.json(
        { error: 'Pages fetched must be a positive number' },
        { status: 400 }
      );
    }

    if (totalPages !== null && (typeof totalPages !== 'number' || totalPages < 1)) {
      return NextResponse.json(
        { error: 'Total pages must be a positive number or null' },
        { status: 400 }
      );
    }

    // Validate failed pages
    if (failedPages !== undefined && !Array.isArray(failedPages)) {
      return NextResponse.json(
        { error: 'Failed pages must be an array' },
        { status: 400 }
      );
    }

    const failedPageCount = Array.isArray(failedPages) ? failedPages.length : 0;

    // STRICT COMPLETENESS VALIDATION
    // Do not accept count mismatches - require reconciliation or block import
    if (complete && allPagesLoaded) {
      // If marked complete, verify the data supports it
      if (failedPageCount > 0) {
        return NextResponse.json(
          { 
            error: 'Scan marked complete but has failed pages. Please rescan.',
            complete: false,
            reason: 'failed_pages_present'
          },
          { status: 400 }
        );
      }

      if (totalPages !== null && pagesFetched < totalPages) {
        return NextResponse.json(
          { 
            error: `Scan marked complete but only ${pagesFetched} of ${totalPages} pages were fetched. Please rescan.`,
            complete: false,
            reason: 'pages_not_fetched'
          },
          { status: 400 }
        );
      }

      // Validate that vehicle count matches expected count if provided
      // Extension may provide summary totalVehicles - require match
      const summaryTotalVehicles = (body as any).totalVehicles;
      if (summaryTotalVehicles !== undefined && typeof summaryTotalVehicles === 'number') {
        if (vehicles.length !== summaryTotalVehicles) {
          return NextResponse.json(
            { 
              error: `Vehicle count mismatch: collected ${vehicles.length} vehicles but summary reports ${summaryTotalVehicles}. The scan may be incomplete or truncated. Please rescan.`,
              complete: false,
              reason: 'count_mismatch',
              collected: vehicles.length,
              expected: summaryTotalVehicles
            },
            { status: 400 }
          );
        }
      }
    }

    // Validate vehicle data
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
    const duplicateVinSet = new Set<string>();
    const invalidVinCount: number[] = [0];

    for (const vehicle of vehicles) {
      // Validate VIN
      if (!vehicle.vin || typeof vehicle.vin !== 'string') {
        invalidVinCount[0]++;
        continue;
      }

      const normalizedVin = vehicle.vin.trim().toUpperCase();
      
      if (!vinRegex.test(normalizedVin)) {
        invalidVinCount[0]++;
        continue;
      }

      // Check for duplicates within scan
      if (duplicateVinSet.has(normalizedVin)) {
        invalidVinCount[0]++;
        continue;
      }

      duplicateVinSet.add(normalizedVin);
    }

    // If too many invalid VINs, reject the scan
    if (invalidVinCount[0] > vehicles.length * 0.5) {
      return NextResponse.json(
        { 
          error: `Too many invalid VINs (${invalidVinCount[0]} of ${vehicles.length}). Please check the scan data.`,
          invalidVinCount: invalidVinCount[0]
        },
        { status: 400 }
      );
    }

    // Check for existing duplicates in dealership
    const supabase = await createSupabaseServerClient();
    const { data: existingVehicles, error: lookupError } = await supabase
      .from('vehicles')
      .select('vin')
      .eq('dealership_id', profile.dealership_id)
      .is('archived_at', null)
      .limit(10000);

    if (lookupError) {
      console.error('Duplicate lookup failed:', lookupError);
      // Don't fail the scan for this error, but log it
    }

    const existingVins = new Set(
      (existingVehicles ?? [])
        .map((row) => String(row.vin ?? '').trim().toUpperCase())
        .filter(Boolean)
    );

    const duplicateCount = Array.from(duplicateVinSet).filter(vin => existingVins.has(vin)).length;

    // Create scan record
    const scanId = await createScanRecord({
      provider: provider.toLowerCase().replace(/\s+/g, '_'),
      sourceUrl: sourceUrl.trim(),
      integrationId: null,
      scanMethod: 'extension',
      vehicles: vehicles,
      complete: complete && failedPageCount === 0,
      allPagesLoaded: allPagesLoaded && failedPageCount === 0,
      pagesFetched,
      totalPages,
    });

    if (!scanId) {
      return NextResponse.json(
        { 
          error: 'Scan record could not be created. Database migration 0055 may not be applied.',
          requiresMigration: true
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scanId,
      vehicleCount: vehicles.length,
      invalidVinCount: invalidVinCount[0],
      duplicateCount,
      complete: complete && failedPageCount === 0,
      allPagesLoaded: allPagesLoaded && failedPageCount === 0,
      pagesFetched,
      totalPages,
    });

  } catch (error) {
    console.error('Extension scan registration error:', error);
    
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
