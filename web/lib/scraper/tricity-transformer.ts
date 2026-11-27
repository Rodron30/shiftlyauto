import type { ShiftlyVehicle } from "./transformer";
import type { TriCityScrapedVehicle } from "./tricitymitsubishi-scraper";

function choosePrice(vehicle: TriCityScrapedVehicle): number | null {
  return (
    vehicle.sale_price ??
    vehicle.internet_price ??
    vehicle.asking_price ??
    vehicle.msrp ??
    null
  );
}

function buildDescription(vehicle: TriCityScrapedVehicle): string | null {
  const parts = [
    vehicle.trim,
    vehicle.body_style,
    vehicle.exterior_color
      ? `Exterior: ${vehicle.exterior_color}`
      : null,
    vehicle.interior_color
      ? `Interior: ${vehicle.interior_color}`
      : null,
    vehicle.stock_number
      ? `Stock #: ${vehicle.stock_number}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" • ") : null;
}

export function transformTriCityVehicle(
  vehicle: TriCityScrapedVehicle,
  dealershipId: string,
  createdBy: string,
): ShiftlyVehicle {
  const vin = vehicle.vin?.trim().toUpperCase() || null;
  const images = [...new Set(vehicle.images.filter(Boolean))];

  return {
    dealership_id: dealershipId,
    vin,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim,
    body: vehicle.body_style,
    engine: vehicle.engine,
    drivetrain: vehicle.drive_train,
    fuel: vehicle.fuel_type,
    transmission: vehicle.transmission,
    price: choosePrice(vehicle),
    currency: vehicle.currency || "CAD",
    mileage: vehicle.odometer,
    mileage_unit: "KM",
    description: buildDescription(vehicle),
    location: "Port Coquitlam, BC, Canada",
    status: "AVAILABLE",
    primary_image: images[0] ?? null,
    images,
    source_url: vehicle.vdp_url ?? null,
    created_by: createdBy,
  };
}

export function transformTriCityVehicles(
  vehicles: TriCityScrapedVehicle[],
  dealershipId: string,
  createdBy: string,
): ShiftlyVehicle[] {
  const seen = new Set<string>();
  const transformed: ShiftlyVehicle[] = [];

  for (const vehicle of vehicles) {
    const vin = vehicle.vin?.trim().toUpperCase();

    if (!vin || seen.has(vin)) {
      continue;
    }

    seen.add(vin);
    transformed.push(
      transformTriCityVehicle(vehicle, dealershipId, createdBy),
    );
  }

  return transformed;
}
