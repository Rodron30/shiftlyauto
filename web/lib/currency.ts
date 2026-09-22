export type SupportedCurrency = "CAD" | "USD" | "PHP";

type FrankfurterRateResponse = {
  base: string;
  quote: string;
  rate: number;
};

export async function convertToCAD(
  amount: number,
  currency: string | null | undefined
): Promise<number | null> {
  if (!Number.isFinite(amount)) return null;

  const source = String(currency || "").toUpperCase();

  if (!source || source === "CAD") {
    return amount;
  }

  if (source !== "USD" && source !== "PHP") {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v2/rate/${source}/CAD`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as FrankfurterRateResponse;

    if (!Number.isFinite(data.rate)) return null;

    return Math.round(amount * data.rate * 100) / 100;
  } catch (error) {
    console.error("Currency conversion error:", error);
    return null;
  }
}

/**
 * Convert miles to kilometers
 * 1 mile = 1.60934 kilometers
 */
export function convertMilesToKm(miles: number): number {
  return Math.round(miles * 1.60934);
}

/**
 * Convert any mileage unit to KM
 * @param mileage - the mileage value
 * @param unit - the unit (KM, MI, KILOMETERS, MILES, etc.)
 * @returns the mileage in KM
 */
export function normalizeMileageToKm(
  mileage: number | null,
  unit: string | null | undefined
): number | null {
  if (mileage === null || !Number.isFinite(mileage)) {
    return null;
  }

  const normalizedUnit = String(unit || "").toUpperCase().trim();
  
  // 0 is a valid mileage value (new vehicles)
  if (mileage === 0) {
    return 0;
  }

  // If already in KM or unit is missing, return as-is
  if (
    !normalizedUnit ||
    normalizedUnit === "KM" ||
    normalizedUnit === "KILOMETERS" ||
    normalizedUnit === "KILOMETRE" ||
    normalizedUnit === "KILOMETRES"
  ) {
    return mileage;
  }

  // Convert from miles/MI to kilometers
  if (
    normalizedUnit === "MI" ||
    normalizedUnit === "MILES" ||
    normalizedUnit === "MILE"
  ) {
    return convertMilesToKm(mileage);
  }

  // Unknown unit, assume KM as default for Canadian market
  return mileage;
}
