// API endpoint to generate Facebook Marketplace listing data
// GET /api/vehicles/[vin]/marketplace-listing

import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getCurrentUserProfile } from '@/lib/supabaseServer';
import { requireSaasAccess } from '@/lib/saas';
import { generateMarketplaceListing, type ShiftlyVehicle } from '@/lib/marketplace/generator';
import type { MarketplaceListingData } from '@/lib/marketplace/types';

export async function GET(
  request: Request,
  context: { params: Promise<{ vin: string }> }
) {
  try {
    // 1. Authentication
    const params = await context.params;
    const supabase = await createSupabaseServerClient();
    const userProfile = await getCurrentUserProfile();

    if (!userProfile) {
      return NextResponse.json(
        { error: 'You must be signed in to generate Marketplace listings.' },
        { status: 401 }
      );
    }

    if (userProfile.role !== 'admin' && userProfile.role !== 'manager') {
      return NextResponse.json(
        { error: 'Only managers and admins can generate Marketplace listings.' },
        { status: 403 }
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

    // 4. Generate Marketplace listing data
    const listingData: MarketplaceListingData = generateMarketplaceListing(
      vehicle as ShiftlyVehicle,
      {
        includeVin: true,
        includeSourceUrl: false,
      }
    );

    // 5. Return the listing data
    return NextResponse.json({
      success: true,
      listing: listingData,
      vehicle_id: vehicle.id,
    });
  } catch (error) {
    console.error('[MARKETPLACE LISTING] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while generating Marketplace listing',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}