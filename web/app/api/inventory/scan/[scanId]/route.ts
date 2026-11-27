import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile, createSupabaseServerClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API endpoint to retrieve a scan record by scanId.
 * Used by the unified preview UI to load scans registered by the extension.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ scanId: string }> }
) {
  try {
    // Authenticate user
    const profile = await getCurrentUserProfile();
    
    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to view scan records.' },
        { status: 401 }
      );
    }

    const { scanId } = await context.params;

    if (!scanId || typeof scanId !== 'string') {
      return NextResponse.json(
        { error: 'Scan ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Query scan record with RLS (automatically filters by dealership and creator)
    const { data: scanRecord, error } = await supabase
      .from('inventory_scan_records')
      .select('*')
      .eq('scan_id', scanId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch scan record:', error);
      
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'Scan records table does not exist. Database migration 0055 may not be applied.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch scan record' },
        { status: 500 }
      );
    }

    if (!scanRecord) {
      return NextResponse.json(
        { error: 'Scan record not found or access denied' },
        { status: 404 }
      );
    }

    // Check if scan has expired
    if (new Date(scanRecord.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Scan record has expired. Please run a new scan.' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      scan_id: scanRecord.scan_id,
      dealership_id: scanRecord.dealership_id,
      provider: scanRecord.provider,
      source_url: scanRecord.source_url,
      scan_method: scanRecord.scan_method,
      vehicle_count: scanRecord.vehicle_count,
      vehicles: scanRecord.vehicles,
      complete: scanRecord.complete,
      all_pages_loaded: scanRecord.all_pages_loaded,
      pages_fetched: scanRecord.pages_fetched,
      total_pages: scanRecord.total_pages,
      expires_at: scanRecord.expires_at,
      created_at: scanRecord.created_at,
      created_by: scanRecord.created_by,
    });

  } catch (error) {
    console.error('Scan fetch error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    
    return NextResponse.json(
      { 
        error: errorMessage
      },
      { status: 500 }
    );
  }
}
