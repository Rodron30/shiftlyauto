// Mapper from Shiftly vehicle to Meta vehicle catalog format
// Maps existing Shiftly vehicle fields to Meta's automotive catalog schema

import type { MetaVehicle } from './types';

export interface ShiftlyVehicle {
  id: string;
  title?: string;
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
  location?: string;
  dealership_id: string;
  created_at: string;
  updated_at: string;
  // Meta sync fields (if added later)
  meta_vehicle_id?: string;
  meta_sync_status?: string;
  meta_last_synced_at?: string;
  meta_sync_error?: string;
}

export function mapShiftlyToMetaVehicle(
  shiftlyVehicle: ShiftlyVehicle,
  dealershipName: string,
  dealershipPhone?: string,
  dealershipAddress?: {
    city: string;
    country: string;
    region: string;
    postal_code?: string;
    street_address?: string;
  }
): MetaVehicle {
  // Map body style to Meta enum
  const bodyStyleMap: Record<string, string> = {
    'sedan': 'SEDAN',
    'suv': 'SUV',
    'coupe': 'COUPE',
    'convertible': 'CONVERTIBLE',
    'hatchback': 'HATCHBACK',
    'pickup': 'PICKUP',
    'truck': 'TRUCK',
    'van': 'VAN',
    'wagon': 'WAGON',
    'crossover': 'CROSSOVER',
  };

  const bodyStyle = bodyStyleMap[shiftlyVehicle.body?.toLowerCase() || ''] || 'OTHER';

  // Map availability from Shiftly status
  const availability = shiftlyVehicle.status === 'AVAILABLE' 
    ? 'AVAILABLE' 
    : shiftlyVehicle.status === 'SOLD' 
    ? 'NOT_AVAILABLE' 
    : 'UNKNOWN';

  // Build image array with primary image first
  const images: Array<{ url: string; tags?: string[] }> = [];
  if (shiftlyVehicle.primary_image) {
    images.push({ url: shiftlyVehicle.primary_image, tags: ['Exterior'] });
  }

  // Construct address (required by Meta)
  const address = dealershipAddress || {
    city: 'Unknown',
    country: 'US',
    region: 'Unknown',
  };

  return {
    // Required fields
    title: `${shiftlyVehicle.year || ''} ${shiftlyVehicle.make || ''} ${shiftlyVehicle.model || ''}`.trim() || 'Vehicle',
    availability,
    body_style: bodyStyle,
    currency: shiftlyVehicle.currency || 'USD',
    price: shiftlyVehicle.price,
    address,
    images,

    // Optional fields
    vin: shiftlyVehicle.vin,
    year: shiftlyVehicle.year,
    make: shiftlyVehicle.make,
    model: shiftlyVehicle.model,
    trim: shiftlyVehicle.trim,
    mileage: shiftlyVehicle.mileage !== undefined && shiftlyVehicle.mileage_unit
      ? {
          value: shiftlyVehicle.mileage,
          unit: shiftlyVehicle.mileage_unit === 'KM' ? 'kms' : 'MI',
        }
      : undefined,
    transmission: shiftlyVehicle.transmission,
    drivetrain: shiftlyVehicle.drivetrain,
    fuel: shiftlyVehicle.fuel,
    dealer_id: shiftlyVehicle.dealership_id,
    dealer_name: dealershipName,
    dealer_phone: dealershipPhone,
    description: shiftlyVehicle.description,
    date_first_on_lot: shiftlyVehicle.created_at,
  };
}