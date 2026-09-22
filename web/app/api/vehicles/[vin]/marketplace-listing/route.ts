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
    console.log("========== MARKETPLACE LISTING API - INPUT VEHICLE ==========");
    console.log("MARKETPLACE LISTING API: make =", vehicle.make);
    console.log("MARKETPLACE LISTING API: model =", vehicle.model);
    console.log("MARKETPLACE LISTING API: year =", vehicle.year);
    console.log("MARKETPLACE LISTING API: body =", vehicle.body);
    console.log("MARKETPLACE LISTING API: exterior_color =", vehicle.exterior_color);
    console.log("MARKETPLACE LISTING API: interior_color =", vehicle.interior_color);
    console.log("MARKETPLACE LISTING API: has_clean_title =", vehicle.has_clean_title);
    console.log("MARKETPLACE LISTING API: condition =", vehicle.status);
    console.log("MARKETPLACE LISTING API: mileage =", vehicle.mileage);
    console.log("MARKETPLACE LISTING API: fuel =", vehicle.fuel);
    console.log("MARKETPLACE LISTING API: transmission =", vehicle.transmission);
    console.log("MARKETPLACE LISTING API: location =", vehicle.location);
    console.log("MARKETPLACE LISTING API: images.length =", vehicle.images?.length || 0);
    console.log("MARKETPLACE LISTING API: vin =", vehicle.vin);
    console.log("============================================================");

    const listingData: MarketplaceListingData = generateMarketplaceListing(
      vehicle as ShiftlyVehicle,
      {
        includeVin: true,
        includeSourceUrl: false,
      }
    );

    console.log("========== MARKETPLACE LISTING API - OUTPUT LISTING ==========");
    console.log("MARKETPLACE LISTING API: make =", listingData.make);
    console.log("MARKETPLACE LISTING API: model =", listingData.model);
    console.log("MARKETPLACE LISTING API: year =", listingData.year);
    console.log("MARKETPLACE LISTING API: body =", listingData.body);
    console.log("MARKETPLACE LISTING API: exteriorColor =", listingData.exteriorColor);
    console.log("MARKETPLACE LISTING API: interiorColor =", listingData.interiorColor);
    console.log("MARKETPLACE LISTING API: hasCleanTitle =", listingData.hasCleanTitle);
    console.log("MARKETPLACE LISTING API: condition =", listingData.condition);
    console.log("MARKETPLACE LISTING API: mileage =", listingData.mileage);
    console.log("MARKETPLACE LISTING API: fuel =", listingData.fuel);
    console.log("MARKETPLACE LISTING API: transmission =", listingData.transmission);
    console.log("MARKETPLACE LISTING API: location =", listingData.location);
    console.log("MARKETPLACE LISTING API: photos.length =", listingData.photos.length);
    console.log("MARKETPLACE LISTING API: vin =", listingData.vin);
    console.log("============================================================");

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