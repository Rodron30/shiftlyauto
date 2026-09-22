// Facebook Marketplace listing generator types
// Server-side listing data generation for Chrome extension

export interface MarketplaceListingData {
  // Basic listing info
  title: string;
  price: number;
  currency: string;
  description: string;
  
  // Vehicle details
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  vin?: string;
  mileage?: number;
  mileage_unit?: string;
  body?: string;
  engine?: string;
  transmission?: string;
  drivetrain?: string;
  fuel?: string;
  
  // Vehicle appearance
  exteriorColor?: string;
  interiorColor?: string;
  
  // Vehicle condition/title
  hasCleanTitle?: boolean;
  condition?: 'new' | 'used' | 'salvage' | 'for_parts';
  
  // Location
  location?: {
    city?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  
  // Photos
  photos: string[];
  
  // Source info
  source_url?: string;
}

export interface MarketplaceListingGeneratorOptions {
  includeVin?: boolean;
  includeSourceUrl?: boolean;
  customDescription?: string;
}