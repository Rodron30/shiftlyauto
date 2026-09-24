import type {
  Integration,
  IntegrationSyncResult,
} from "./types";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { crawlInventory } from "@/lib/scraper/inventory-crawler";
import { transformBatchToShiftlyVehicles } from "@/lib/scraper/transformer";

export async function syncInventory(
  integration: Integration
): Promise<IntegrationSyncResult> {
  console.log(`📦 syncInventory function entered: Integration ID ${integration.id}`);

  const config = integration.config ?? {};
  const inventoryUrl =
    typeof config.inventory_url === "string"
      ? config.inventory_url.trim()
      : "";

  console.log(`🔗 Inventory URL from config: ${inventoryUrl}`);

  const maxVehicles =
    typeof config.max_vehicles === "number" &&
    Number.isFinite(config.max_vehicles) &&
    config.max_vehicles > 0
      ? Math.min(Math.floor(config.max_vehicles), 500)
      : 100;

  console.log(`🔢 Max vehicles from config: ${maxVehicles}`);

  if (!inventoryUrl) {
    console.log(`❌ BLOCKER: Inventory URL not configured`);
    return {
      status: "FAILED",
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errorMessage: "Missing inventory_url in integration config.",
    };
  }

  if (!integration.created_by) {
    console.log(`❌ BLOCKER: Integration has no created_by user`);
    return {
      status: "FAILED",
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errorMessage: "Integration has no created_by user.",
    };
  }

  console.log(`🔄 Starting inventory sync for: ${inventoryUrl} with max ${maxVehicles} vehicles`);

  const { vehicles: scrapedVehicles, errors: scrapeErrors } =
    await crawlInventory(inventoryUrl, {
      maxVehicles,
      delayMs: 1000,
    });

  console.log(`📊 Crawler Results:`, {
    scrapedVehicles: scrapedVehicles.length,
    scrapeErrors: scrapeErrors.length,
    errorDetails: scrapeErrors.map(e => e.error)
  });

  if (scrapedVehicles.length === 0) {
    console.log(`❌ BLOCKER: No vehicles returned from crawler - discovery/scraper issue`);
    return {
      status: "FAILED",
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: scrapeErrors.length,
      errorMessage:
        scrapeErrors.length > 0
          ? `Inventory crawl returned no vehicles. ${scrapeErrors.length} scrape error(s).`
          : "Inventory crawl returned no vehicles.",
    };
  }

  console.log(`✅ Crawler returned ${scrapedVehicles.length} vehicles, proceeding to transformation...`);

  console.log(`🔄 Starting transformation of ${scrapedVehicles.length} vehicles...`);

  const transformedVehicles = await transformBatchToShiftlyVehicles(
    scrapedVehicles,
    integration.dealership_id,
    integration.created_by
  );

  console.log(`✅ Transformation completed: ${transformedVehicles.length} vehicles transformed`);

  const supabase = await createSupabaseServerClient();

  console.log(`🗄️ Starting database operations for ${transformedVehicles.length} vehicles...`);

  let recordsCreated = 0;
  let recordsUpdated = 0;
  let recordsFailed = scrapeErrors.length;

  for (const vehicle of transformedVehicles) {
    const vin = vehicle.vin?.trim().toUpperCase();

    console.log(`🚗 Processing vehicle: VIN ${vin}, images: ${vehicle.images?.length || 0}`);

    // VIN is the inventory matching key.
    // Vehicles without VIN are skipped rather than creating
    // duplicate records on every scheduled sync.
    if (!vin) {
      console.log(`⚠️ Skipping vehicle without VIN`);
      recordsFailed += 1;
      continue;
    }

    try {
      const { data: existingVehicle, error: lookupError } =
        await supabase
          .from("vehicles")
          .select("id")
          .eq("dealership_id", integration.dealership_id)
          .eq("vin", vin)
          .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      console.log(`🔍 Database lookup for VIN ${vin}: ${existingVehicle ? 'found' : 'not found'}`);

      const vehicleData = {
        dealership_id: integration.dealership_id,
        vin,
        year: vehicle.year ?? null,
        make: vehicle.make ?? null,
        model: vehicle.model ?? null,
        trim: vehicle.trim ?? null,
        body: vehicle.body ?? null,
        engine: vehicle.engine ?? null,
        drivetrain: vehicle.drivetrain ?? null,
        fuel: vehicle.fuel ?? null,
        transmission: vehicle.transmission ?? null,
        price: vehicle.price ?? null,
        currency: vehicle.currency ?? null, // Keep null if source didn't provide currency
        mileage: vehicle.mileage ?? null,
        mileage_unit: vehicle.mileage_unit ?? null, // Keep null if source didn't provide unit
        description: vehicle.description ?? null,
        location: vehicle.location ?? null,
        status: "AVAILABLE",
        primary_image: vehicle.primary_image ?? null,
        images: vehicle.images ?? [], // Preserve complete image array
        created_by: integration.created_by,
        updated_at: new Date().toISOString(),
      };

      console.log(`🔗 Database save: VIN ${vin} - ${vehicleData.images.length} images being saved`);

      if (existingVehicle?.id) {
        console.log(`🔄 Updating existing vehicle: VIN ${vin}`);
        const { error: updateError } = await supabase
          .from("vehicles")
          .update(vehicleData)
          .eq("id", existingVehicle.id)
          .eq("dealership_id", integration.dealership_id);

        if (updateError) {
          throw updateError;
        }

        recordsUpdated += 1;
        console.log(`✅ Update successful: VIN ${vin}`);
      } else {
        console.log(`➕ Creating new vehicle: VIN ${vin}`);
        const { error: insertError } = await supabase
          .from("vehicles")
          .insert(vehicleData);

        if (insertError) {
          throw insertError;
        }

        recordsCreated += 1;
        console.log(`✅ Create successful: VIN ${vin}`);
      }
    } catch (error) {
      recordsFailed += 1;
      console.error(
        "❌ Vehicle sync error:",
        vin,
        error
      );
    }
  }

  const recordsProcessed = transformedVehicles.length;

  console.log(`📊 Final sync results:`, {
    recordsProcessed,
    recordsCreated,
    recordsUpdated,
    recordsFailed
  });

  return {
    status:
      recordsFailed > 0
        ? recordsCreated + recordsUpdated > 0
          ? "PARTIAL"
          : "FAILED"
        : "SUCCESS",
    recordsProcessed,
    recordsCreated,
    recordsUpdated,
    recordsFailed,
    errorMessage:
      recordsFailed > 0
        ? `${recordsFailed} vehicle(s) failed during inventory sync.`
        : undefined,
  };
}
