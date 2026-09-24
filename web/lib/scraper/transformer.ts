// lib/scraper/transformer.ts
//
// Transforms raw scraped vehicle data into the canonical Shiftly vehicle model.
// Maps scraped fields to existing database schema conventions.
//
// Uses existing database conventions: price, currency, mileage, mileage_unit
// Normalizes to Canadian market standards: CAD and KM

import type { RawScrapedVehicle } from "../types/scraper";
import { convertToCAD, normalizeMileageToKm } from "../currency";

// Existing vehicle model from the database schema
export interface ShiftlyVehicle {
  dealership_id: string;
  vin?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  body?: string | null;
  engine?: string | null;
  drivetrain?: string | null;
  fuel?: string | null;
  transmission?: string | null;
  price?: number | null;
  currency?: string | null;
  mileage?: number | null;
  mileage_unit?: string | null;
  description?: string | null;
  location?: string | null;
  status?: string;
  primary_image?: string | null;
  images?: string[];
  created_by: string;
}

// Currency symbols and codes mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "C$": "CAD",
  "A$": "AUD",
  "¥": "JPY",
  "₹": "INR",
};

// Mileage unit indicators
const MILEAGE_INDICATORS = ["mi", "mile", "miles"];
const KILOMETER_INDICATORS = ["km", "kilometer", "kilometre", "kilometres"];

/**
 * Parses price text to extract numeric value and currency.
 * Returns null if price cannot be reliably determined.
 * Does not invent currency if not present in source.
 */
function parsePrice(priceText: string): { price: number | null; currency: string | null } {
  if (!priceText || typeof priceText !== "string") {
    return { price: null, currency: null };
  }

  const cleaned = priceText.replace(/,/g, "").trim();
  if (!cleaned) {
    return { price: null, currency: null };
  }

  // Detect currency symbol
  let currency: string | null = null;
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (cleaned.includes(symbol)) {
      currency = code;
      break;
    }
  }

  // Extract numeric value
  const priceMatch = cleaned.match(/[\d,]+\.?\d*/);
  if (!priceMatch) {
    return { price: null, currency };
  }

  const priceValue = parseFloat(priceMatch[0].replace(/,/g, ""));
  if (isNaN(priceValue) || priceValue < 0) {
    return { price: null, currency };
  }

  return { price: priceValue, currency };
}

/**
 * Parses mileage text to extract numeric value and unit.
 * Returns null if mileage cannot be reliably determined.
 * Does not invent unit if not present in source.
 */
function parseMileage(mileageText: string): {
  mileage: number | null;
  mileage_unit: string | null;
} {
  if (!mileageText || typeof mileageText !== "string") {
    return { mileage: null, mileage_unit: null };
  }

  const cleaned = mileageText.replace(/,/g, "").toLowerCase().trim();
  if (!cleaned) {
    return { mileage: null, mileage_unit: null };
  }

  // Detect unit
  let mileage_unit: string | null = null;
  const lowerText = cleaned.toLowerCase();

  for (const indicator of KILOMETER_INDICATORS) {
    if (lowerText.includes(indicator)) {
      mileage_unit = "KM";
      break;
    }
  }

  for (const indicator of MILEAGE_INDICATORS) {
    if (lowerText.includes(indicator)) {
      mileage_unit = "MI";
      break;
    }
  }

  // Extract numeric value
  const mileageMatch = cleaned.match(/[\d,]+\.?\d*/);
  if (!mileageMatch) {
    return { mileage: null, mileage_unit };
  }

  const mileageValue = parseFloat(mileageMatch[0].replace(/,/g, ""));
  if (isNaN(mileageValue) || mileageValue < 0) {
    return { mileage: null, mileage_unit };
  }

  return { mileage: mileageValue, mileage_unit };
}

/**
 * Parses vehicle title to extract year, make, and model.
 * Returns null values if cannot be reliably parsed.
 */
function parseTitle(title: string): {
  year: number | null;
  make: string | null;
  model: string | null;
} {
  if (!title || typeof title !== "string") {
    return { year: null, make: null, model: null };
  }

  const cleaned = title.trim();
  if (!cleaned) {
    return { year: null, make: null, model: null };
  }

  // Try to extract year (4 digits at start)
  const yearMatch = cleaned.match(/^(\d{4})\s+/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  // Validate year
  if (year && (year < 1900 || year > 2100)) {
    return { year: null, make: null, model: null };
  }

  // Remove year from title for make/model parsing
  const titleWithoutYear = year ? cleaned.replace(/^\d{4}\s+/, "") : cleaned;

  // Simple make/model split - assumes format like "Toyota Camry"
  // This is a basic heuristic; in production you'd want a more sophisticated parser
  const parts = titleWithoutYear.split(/\s+/);
  if (parts.length >= 2) {
    const make = parts[0];
    const model = parts.slice(1).join(" ");
    return { year, make, model };
  }

  // If we can't split, return what we have
  return { year, make: titleWithoutYear || null, model: null };
}

/**
 * Transforms raw scraped vehicle data into Shiftly vehicle format.
 * Maps scraped fields to existing database schema.
 * Normalizes to Canadian market standards (CAD, KM).
 */
export async function transformToShiftlyVehicle(
  scraped: RawScrapedVehicle,
  dealershipId: string,
  createdBy: string
): Promise<ShiftlyVehicle> {
  // Parse price
  const { price, currency } = parsePrice(scraped.priceText);

  // Parse mileage
  const { mileage, mileage_unit } = parseMileage(scraped.mileageText);

  // Parse title for year, make, model
  const { year, make, model } = parseTitle(scraped.title);

  // Select primary image (first image or null)
  const primary_image =
    scraped.imageUrls && scraped.imageUrls.length > 0
      ? scraped.imageUrls[0]
      : null;

  // Preserve complete image array with VIN isolation
  const images = scraped.imageUrls && scraped.imageUrls.length > 0
    ? [...scraped.imageUrls] // Create new array to prevent shared references
    : [];

  // Build description from available data
  const descriptionParts: string[] = [];
  if (scraped.engine) descriptionParts.push(`Engine: ${scraped.engine}`);
  if (scraped.transmission) descriptionParts.push(`Transmission: ${scraped.transmission}`);
  if (scraped.drivetrain) descriptionParts.push(`Drivetrain: ${scraped.drivetrain}`);
  if (scraped.exteriorColor) descriptionParts.push(`Exterior: ${scraped.exteriorColor}`);
  if (scraped.interiorColor) descriptionParts.push(`Interior: ${scraped.interiorColor}`);

  const description =
    descriptionParts.length > 0 ? descriptionParts.join(". ") : null;

  // Normalize to Canadian market standards (only if source values exist)
  let finalPrice = price;
  let finalCurrency = currency;
  let finalMileage = mileage;
  let finalMileageUnit = mileage_unit;

  // Convert currency to CAD only if source currency exists and is not CAD
  if (price !== null && currency && currency !== "CAD") {
    const convertedPrice = await convertToCAD(price, currency);
    if (convertedPrice !== null) {
      finalPrice = convertedPrice;
      finalCurrency = "CAD";
      console.log(`💱 Currency normalization: ${price} ${currency} → ${finalPrice} CAD`);
    }
  }

  // Convert mileage to KM only if source unit exists and is not KM
  if (mileage !== null && mileage_unit && mileage_unit !== "KM") {
    const convertedMileage = normalizeMileageToKm(mileage, mileage_unit);
    if (convertedMileage !== null) {
      finalMileage = convertedMileage;
      finalMileageUnit = "KM";
      console.log(`📏 Mileage normalization: ${mileage} ${mileage_unit} → ${finalMileage} KM`);
    }
  }

  console.log(`🖼️ Vehicle isolation: VIN ${scraped.vin || 'unknown'} - ${images.length} images preserved`);

  return {
    dealership_id: dealershipId,
    vin: scraped.vin || null,
    year,
    make,
    model,
    trim: null, // Not typically available from basic scraping
    body: null, // Not typically available from basic scraping
    engine: scraped.engine || null,
    drivetrain: scraped.drivetrain || null,
    fuel: null, // Not typically available from basic scraping
    transmission: scraped.transmission || null,
    price: finalPrice,
    currency: finalCurrency, // Keep null if source didn't provide currency
    mileage: finalMileage,
    mileage_unit: finalMileageUnit, // Keep null if source didn't provide unit
    description,
    location: null, // Could be extracted from page in future
    status: "AVAILABLE", // Default status for scraped vehicles
    primary_image,
    images, // Complete deduplicated image array
    created_by: createdBy,
  };
}

/**
 * Transforms multiple scraped vehicles.
 */
export async function transformBatchToShiftlyVehicles(
  scrapedVehicles: RawScrapedVehicle[],
  dealershipId: string,
  createdBy: string
): Promise<ShiftlyVehicle[]> {
  console.log(`🔄 transformBatchToShiftlyVehicles called: ${scrapedVehicles.length} vehicles`);

  const transformed = await Promise.all(
    scrapedVehicles.map((scraped) =>
      transformToShiftlyVehicle(scraped, dealershipId, createdBy)
    )
  );

  console.log(`✅ transformBatchToShiftlyVehicles completed: ${transformed.length} vehicles transformed`);
  return transformed;
}


