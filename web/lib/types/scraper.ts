// lib/types/scraper.ts
//
// Type definitions for the dealership inventory scraper.
// These types represent raw scraped data from dealership websites,
// before normalization into the canonical Shiftly vehicle model.

export interface RawScrapedVehicle {
  title: string;
  vin?: string;
  priceText: string;
  mileageText: string;
  engine?: string;
  transmission?: string;
  drivetrain?: string;
  exteriorColor?: string;
  interiorColor?: string;
  imageUrls: string[];
  sourceUrl: string;
}

export interface ScrapedVehiclePreview {
  vehicles: RawScrapedVehicle[];
  totalFound: number;
  totalProcessed: number;
  errors: string[];
  sourceUrl: string;
}

export interface CrawlerOptions {
  maxVehicles: number;
  delayMs: number;
  userAgent?: string;
}

export interface ScraperError {
  url: string;
  error: string;
  timestamp: string;
}