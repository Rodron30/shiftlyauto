import { createSupabaseServerClient, getCurrentUserProfile } from '@/lib/supabaseServer';
import { VehiclePreview } from './vehicle-types';

function generateScanId(): string {
  return crypto.randomUUID();
}

export interface ScanRecord {
  id: string;
  scan_id: string;
  dealership_id: string;
  provider: string;
  source_url: string;
  scan_method: 'feed' | 'extension' | 'scrape';
  vehicle_count: number;
  vehicles: VehiclePreview[];
  complete: boolean;
  all_pages_loaded: boolean;
  pages_fetched: number;
  total_pages: number | null;
  expires_at: string;
  created_at: string;
  created_by: string | null;
}

/**
 * Check if scan records table exists.
 * Only treats PostgreSQL error code 42P01 as missing table.
 */
async function scanRecordsTableExists(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('inventory_scan_records')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    if (error?.code === '42P01') {
      return false;
    }
    
    if (error) {
      console.error('Error checking scan records table:', error);
      return true; // Assume table exists for safety
    }
    
    return true;
  } catch (error) {
    console.error('Unexpected error checking scan records table:', error);
    return true;
  }
}

/**
 * Create a scan record in the database.
 * Returns the scan_id for client reference.
 * Returns null if table doesn't exist (graceful degradation).
 */
export async function createScanRecord(params: {
  provider: string;
  sourceUrl: string;
  integrationId: string | null;
  scanMethod: 'feed' | 'extension' | 'scrape';
  vehicles: VehiclePreview[];
  complete: boolean;
  allPagesLoaded: boolean;
  pagesFetched: number;
  totalPages: number | null;
}): Promise<string | null> {
  const tableExists = await scanRecordsTableExists();
  
  if (!tableExists) {
    console.warn('inventory_scan_records table does not exist. Scan record will not be stored.');
    return null;
  }

  const profile = await getCurrentUserProfile();
  if (!profile?.dealership_id) {
    throw new Error('Authentication required');
  }

  const supabase = await createSupabaseServerClient();

  const scanId = generateScanId();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { error } = await supabase.from('inventory_scan_records').insert({
    scan_id: scanId,
    dealership_id: profile.dealership_id,
    integration_id: params.integrationId,
    provider: params.provider,
    source_url: params.sourceUrl,
    scan_method: params.scanMethod,
    vehicle_count: params.vehicles.length,
    vehicles: params.vehicles,
    complete: params.complete,
    all_pages_loaded: params.allPagesLoaded,
    pages_fetched: params.pagesFetched,
    total_pages: params.totalPages,
    expires_at: expiresAt,
    created_by: profile.id,
  });

  if (error) {
    console.error('Failed to create scan record:', error);
    throw new Error('Could not create scan record');
  }

  return scanId;
}

/**
 * Check if import is available (table exists).
 * Import is disabled without the table.
 */
export async function isImportAvailable(): Promise<boolean> {
  return await scanRecordsTableExists();
}

