// lib/vinDecode.ts
//
// Vehicle decode step (Blueprint Â§8, Â§9, Â§34).
// Uses NHTSA's free vPIC API (no key required) as the V1 decode source.
// Only fields the provider actually returns are surfaced â€” the blueprint
// is explicit that unverified fields must never be displayed as fact
// (Â§9 "Only information actually returned by the data source should be
// displayed as verified vehicle data.")

export type DecodedVehicle = {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  body: string | null;
  engine: string | null;
  drivetrain: string | null;
  fuel: string | null;
};

type NhtsaResult = {
  Variable: string;
  Value: string | null;
};

const FIELD_MAP: Record<string, keyof DecodedVehicle> = {
  "Model Year": "year",
  Make: "make",
  Model: "model",
  Trim: "trim",
  "Body Class": "body",
  "Drive Type": "drivetrain",
};

function cleanValue(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "not applicable") return null;
  return trimmed;
}

function buildEngineSummary(results: NhtsaResult[]): string | null {
  const lookup = (variable: string) =>
    cleanValue(results.find((r) => r.Variable === variable)?.Value ?? null);

  const displacementL = lookup("DisplacementL");
  const cylinders = lookup("EngineCylinders");

  // Fuel type is now surfaced as its own field (Blueprint Â§9) â€” kept out
  // of this string so it isn't duplicated between Engine and Fuel.
  const parts: string[] = [];
  if (displacementL) parts.push(`${displacementL}L`);
  if (cylinders) parts.push(`${cylinders}-cyl`);

  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Decodes a 17-character VIN using NHTSA's public vPIC API.
 * Returns null on any network/parse failure so callers can surface a
 * "decode unavailable" state instead of a false result (Blueprint Â§40).
 */
export async function decodeVin(
  vin: string
): Promise<DecodedVehicle | null> {
  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(
        vin
      )}?format=json`,
      { cache: "no-store" }
    );

    if (!response.ok) return null;

    const json = await response.json();
    const record = json?.Results?.[0];
    if (!record) return null;

    const make = cleanValue(record.Make);
    const model = cleanValue(record.Model);
    const yearRaw = cleanValue(record.ModelYear);
    const errorCode = cleanValue(record.ErrorCode);

    // NHTSA returns ErrorCode "1" for VINs it cannot decode at all.
    if (!make && !model && (!errorCode || errorCode !== "0")) {
      return null;
    }

    const asPairs: NhtsaResult[] = Object.entries(record).map(
      ([Variable, Value]) => ({
        Variable,
        Value: (Value as string) ?? null,
      })
    );

    return {
      year: yearRaw ? Number.parseInt(yearRaw, 10) || null : null,
      make,
      model,
      trim: cleanValue(record.Trim),
      body: cleanValue(record.BodyClass),
      engine: buildEngineSummary(asPairs),
      drivetrain: cleanValue(record.DriveType),
      fuel: cleanValue(record.FuelTypePrimary),
    };
  } catch (error) {
    console.error("VIN decode error:", error);
    return null;
  }
}

export { FIELD_MAP };

