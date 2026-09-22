// API endpoint to sync a single Shiftly vehicle to Meta catalog
// POST /api/vehicles/[vin]/sync-meta

import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getCurrentUserProfile } from '@/lib/supabaseServer';
import { requireSaasAccess } from '@/lib/saas';
import { mapShiftlyToMetaVehicle, type ShiftlyVehicle } from '@/lib/meta/mapper';
import { MetaCatalogService } from '@/lib/meta/catalog-service';
import type { MetaSyncResult } from '@/lib/meta/types';

export async function POST(
  request: Request,
  context: { params: Promise<{ vin: string }> }
) {
  try {
    // 1. Authentication
    const params = await context.params;
    const supabase = createSupabaseServerClient();
    const userProfile = await getCurrentUserProfile();

    if (!userProfile) {
      return NextResponse.json(
        { error: 'You must be signed in to sync vehicles to Meta.' },
        { status: 401 }
      );
    }

    // 2. SaaS access check
    const saasAccess = await requireSaasAccess();
    if (!saasAccess.ok) {
      return NextResponse.json(
        { error: saasAccess.error },
        { status: saasAccess.status }
      );
    }

    const { dealership_id } = userProfile;

    // 3. Fetch the vehicle
    const { data: vehicle, error: vehicleError } = await (await supabase)
      .from('vehicles')
      .select('*')
      .eq('vin', params.vin)
      .eq('dealership_id', dealership_id)
      .single();

    if (vehicleError || !vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found or access denied' },
        { status: 404 }
      );
    }

    // 4. Check Meta integration configuration
    const { data: integration, error: integrationError } = await (await supabase)
      .from('integrations')
      .select('*')
      .eq('dealership_id', dealership_id)
      .eq('integration_type', 'INVENTORY')
      .eq('provider', 'meta')
      .eq('status', 'CONNECTED')
      .single();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'Meta integration not configured or not connected. Please configure Meta integration in Settings.' },
        { status: 400 }
      );
    }

    const config = integration.config as {
      catalog_id: string;
      page_id: string;
      business_account_id: string;
      access_token?: string;
    };

    if (!config.catalog_id || !config.access_token) {
      return NextResponse.json(
        { error: 'Meta integration is missing required configuration (catalog_id or access_token).' },
        { status: 400 }
      );
    }

    // 5. Get dealership info for Meta mapping
    const { data: dealership } = await (await supabase)
      .from('dealerships')
      .select('name, location')
      .eq('id', dealership_id)
      .single();

    // 6. Map Shiftly vehicle to Meta format
    const metaVehicle = mapShiftlyToMetaVehicle(
      vehicle as ShiftlyVehicle,
      dealership?.name || 'Unknown Dealership',
      undefined, // dealer_phone - add later if available
      dealership?.location ? JSON.parse(dealership.location) : undefined
    );

    // 7. Sync to Meta catalog
    const catalogService = new MetaCatalogService(
      config.catalog_id,
      config.access_token,
      'v20.0'
    );

    const syncResult: MetaSyncResult = await catalogService.syncVehicle(
      metaVehicle,
      vehicle.id
    );

    // 8. Log the sync
    await (await supabase).from('integration_sync_logs').insert({
      integration_id: integration.id,
      dealership_id,
      sync_type: 'EXPORT',
      status: syncResult.success ? 'SUCCESS' : 'FAILED',
      records_processed: 1,
      records_created: syncResult.success ? 1 : 0,
      records_failed: syncResult.success ? 0 : 1,
      error_message: syncResult.error,
    });

    // 9. Update integration last_sync_at
    if (syncResult.success) {
      await (await supabase)
        .from('integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', integration.id);
    } else {
      await (await supabase)
        .from('integrations')
        .update({
          last_error: syncResult.error,
        })
        .eq('id', integration.id);
    }

    // 10. Return result
    if (syncResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Vehicle synced to Meta catalog successfully',
        vehicle_id: vehicle.id,
        meta_vehicle_id: syncResult.meta_vehicle_id,
        details: syncResult.details,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: syncResult.error,
          details: syncResult.details,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[META SYNC] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred during Meta sync',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}