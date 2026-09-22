// Meta / Facebook Automotive Inventory Ads integration types
// Server-side only - never exposed to client

export interface MetaVehicleCatalogConfig {
  catalog_id: string;
  page_id: string;
  business_account_id: string;
  access_token?: string; // In production, this should be in secure storage
  last_sync_at?: string;
  sync_status?: 'CONNECTED' | 'SYNCING' | 'ERROR' | 'DISABLED';
}

export interface MetaVehicle {
  // Required fields
  title: string;
  availability: 'AVAILABLE' | 'NOT_AVAILABLE' | 'PENDING' | 'UNKNOWN';
  body_style: string;
  currency: string;
  price: number;
  address: {
    city: string;
    country: string;
    region: string;
    postal_code?: string;
    street_address?: string;
  };
  images: Array<{
    url: string;
    tags?: string[];
  }>;

  // Optional fields
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: {
    value: number;
    unit: 'MI' | 'kms';
  };
  transmission?: string;
  drivetrain?: string;
  fuel?: string;
  exterior_color?: string;
  interior_color?: string;
  dealer_id?: string;
  dealer_name?: string;
  dealer_phone?: string;
  url?: string;
  description?: string;
  date_first_on_lot?: string;
}

export interface MetaSyncResult {
  success: boolean;
  vehicle_id?: string;
  meta_vehicle_id?: string;
  error?: string;
  details?: string;
}

export interface MetaCatalogSyncResult {
  total_vehicles: number;
  successful: number;
  failed: number;
  errors: Array<{
    vehicle_id: string;
    error: string;
  }>;
}