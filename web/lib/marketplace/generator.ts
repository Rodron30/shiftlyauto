// Facebook Marketplace listing generator
// Converts Shiftly vehicle data to Marketplace-ready listing format

import type { MarketplaceListingData, MarketplaceListingGeneratorOptions } from './types';

// Facebook Marketplace maximum photos (platform limit)
const MAX_FACEBOOK_PHOTOS = 20;

export interface ShiftlyVehicle {
  id: string;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  body?: string;
  engine?: string;
  drivetrain?: string;
  fuel?: string;
  price: number;
  currency: string;
  mileage?: number;
  mileage_unit?: string;
  transmission?: string;
  description?: string;
  status: string;
  primary_image?: string;
  images?: string[];
  location?: string;
  exterior_color?: string;
  interior_color?: string;
  has_clean_title?: boolean;
  condition?: string;
  created_at: string;
  updated_at: string;
}

export function generateMarketplaceListing(
  vehicle: ShiftlyVehicle,
  options: MarketplaceListingGeneratorOptions = {}
): MarketplaceListingData {
  // Determine condition based on status and mileage
  let condition: 'new' | 'used' | 'salvage' | 'for_parts' = 'used';
  if (vehicle.status === 'AVAILABLE' && (!vehicle.mileage || vehicle.mileage < 100)) {
    condition = 'new';
  } else if (vehicle.status === 'SOLD' || vehicle.status === 'ARCHIVED') {
    condition = 'for_parts';
  }

  // Generate compelling title
  const title = generateTitle(vehicle);

  // Use ONLY the original vehicle description
  const description = vehicle.description || '';

  // Collect photos - use images array if available, fallback to primary_image
  const photos: string[] = [];
  if (vehicle.images && Array.isArray(vehicle.images) && vehicle.images.length > 0) {
    photos.push(...vehicle.images);
  } else if (vehicle.primary_image) {
    photos.push(vehicle.primary_image);
  }

  // Apply Facebook Marketplace photo limit
  const photosForMarketplace = photos.slice(0, MAX_FACEBOOK_PHOTOS);

  // Validate Canadian market standards
  if (vehicle.currency !== "CAD") {
    console.warn(`Marketplace listing: Currency is ${vehicle.currency}, expected CAD. This should have been normalized at vehicle API level.`);
  }
  if (vehicle.mileage_unit !== "KM") {
    console.warn(`Marketplace listing: Mileage unit is ${vehicle.mileage_unit}, expected KM. This should have been normalized at vehicle API level.`);
  }

  // Normalize location for Marketplace
  let location:
    | {
        city?: string;
        region?: string;
        postal_code?: string;
        country?: string;
      }
    | undefined;

  if (vehicle.location) {
    if (typeof vehicle.location === 'string') {
      const rawLocation = vehicle.location.trim();

      if (rawLocation) {
        try {
          const parsed = JSON.parse(rawLocation);

          if (parsed && typeof parsed === 'object') {
            location = parsed;
          } else {
            location = {
              city: rawLocation,
            };
          }
        } catch {
          const parts = rawLocation
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);

          if (parts.length >= 2) {
            location = {
              city: parts[0],
              region: parts[1],
            };
          } else {
            location = {
              city: rawLocation,
            };
          }
        }
      }
    } else {
      location = vehicle.location;
    }
  }

  const listing = {
    title,
    price: vehicle.price,
    currency: vehicle.currency,
    description,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim,
    vin: options.includeVin ? vehicle.vin : undefined,
    mileage: vehicle.mileage,
    mileage_unit: vehicle.mileage_unit,
    body: vehicle.body,
    engine: vehicle.engine,
    transmission: vehicle.transmission,
    drivetrain: vehicle.drivetrain,
    fuel: vehicle.fuel,
    condition,
    location,
    exteriorColor: vehicle.exterior_color,
    interiorColor: vehicle.interior_color,
    hasCleanTitle: vehicle.has_clean_title,
    photos: photosForMarketplace,
    source_url: options.includeSourceUrl ? vehicle.primary_image : undefined,
  };

  // Diagnostic logging for data pipeline trace
  console.log("========== MARKETPLACE GENERATOR OUTPUT ==========");
  console.log("MARKETPLACE GENERATOR: make =", listing.make);
  console.log("MARKETPLACE GENERATOR: model =", listing.model);
  console.log("MARKETPLACE GENERATOR: year =", listing.year);
  console.log("MARKETPLACE GENERATOR: body =", listing.body);
  console.log("MARKETPLACE GENERATOR: exteriorColor =", listing.exteriorColor);
  console.log("MARKETPLACE GENERATOR: interiorColor =", listing.interiorColor);
  console.log("MARKETPLACE GENERATOR: hasCleanTitle =", listing.hasCleanTitle);
  console.log("MARKETPLACE GENERATOR: condition =", listing.condition);
  console.log("MARKETPLACE GENERATOR: mileage =", listing.mileage);
  console.log("MARKETPLACE GENERATOR: fuel =", listing.fuel);
  console.log("MARKETPLACE GENERATOR: transmission =", listing.transmission);
  console.log("MARKETPLACE GENERATOR: location =", listing.location);
  console.log("MARKETPLACE GENERATOR: photos.length =", listing.photos.length);
  console.log("MARKETPLACE GENERATOR: vin =", listing.vin);
  console.log("======================================================");

  return listing;
}

function generateTitle(vehicle: ShiftlyVehicle): string {
  const parts = [];
  
  if (vehicle.year) parts.push(vehicle.year.toString());
  if (vehicle.make) parts.push(vehicle.make);
  if (vehicle.model) parts.push(vehicle.model);
  if (vehicle.trim) parts.push(vehicle.trim);
  
  if (parts.length === 0) {
    return 'Vehicle for Sale';
  }
  
  return parts.join(' ');
}

