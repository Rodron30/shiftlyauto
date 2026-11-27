import type {
  Integration,
  IntegrationSyncResult,
} from "./types";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { scrapeDealerInspireInventory } from "@/lib/scraper/dealerinspire-scraper";
import { crawlInventory } from "@/lib/scraper/inventory-crawler";
import { transformBatchToShiftlyVehicles } from "@/lib/scraper/transformer";
import type {
  RawScrapedVehicle,
  ScraperError,
} from "@/lib/types/scraper";

export async function syncDealerWebsite(
  integration: Integration
): Promise<IntegrationSyncResult> {
  console.log(
    `[Website Sync] Started for integration ${integration.id}`
  );

  const config = integration.config ?? {};

  const inventoryUrl =
    typeof config.inventory_url === "string"
      ? config.inventory_url.trim()
      : "";

  const maxVehicles =
    typeof config.max_vehicles === "number" &&
    Number.isFinite(config.max_vehicles) &&
    config.max_vehicles > 0
      ? Math.min(Math.floor(config.max_vehicles), 500)
      : 100;

  const failedResult = (
    errorMessage: string,
    recordsFailed = 0
  ): IntegrationSyncResult => ({
    status: "FAILED",
    recordsProcessed: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsFailed,
    errorMessage,
  });

  if (!inventoryUrl) {
    return failedResult(
      "Missing inventory_url in integration config."
    );
  }

  if (!integration.created_by) {
    return failedResult(
      "Integration has no created_by user."
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(inventoryUrl);

    if (
      parsedUrl.protocol !== "https:" &&
      parsedUrl.protocol !== "http:"
    ) {
      return failedResult(
        "Inventory URL must use HTTP or HTTPS."
      );
    }

    if (parsedUrl.username || parsedUrl.password) {
      return failedResult(
        "Inventory URLs containing embedded credentials are not allowed."
      );
    }
  } catch {
    return failedResult("Invalid inventory_url.");
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  const isDealerInspire =
    hostname === "dealerinspire.com" ||
    hostname.endsWith(".dealerinspire.com");

  console.log("[Website Sync] Configuration:", {
    hostname,
    isDealerInspire,
    maxVehicles,
  });

  let scrapedVehicles: RawScrapedVehicle[] = [];
  let scrapeErrors: ScraperError[] = [];
  let scrapeComplete = false;

  try {
    if (isDealerInspire) {
      const result = await scrapeDealerInspireInventory(
        inventoryUrl,
        maxVehicles
      );

      scrapedVehicles = result.vehicles;
      scrapeErrors = result.errors;
      scrapeComplete =
        result.complete && scrapeErrors.length === 0;
    } else {
      const result = await crawlInventory(inventoryUrl, {
        maxVehicles,
        delayMs: 1000,
      });

      scrapedVehicles = result.vehicles;
      scrapeErrors = result.errors;
      scrapeComplete =
        result.complete && scrapeErrors.length === 0;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    console.error("[Website Sync] Scraping failed:", message);

    return failedResult(
      `Website scraping failed: ${message}`,
      1
    );
  }

  console.log("[Website Sync] Scrape results:", {
    vehicles: scrapedVehicles.length,
    errors: scrapeErrors.length,
    complete: scrapeComplete,
  });

  if (scrapedVehicles.length === 0) {
    const details = scrapeErrors
      .map((error) => error.error)
      .filter(Boolean)
      .join("; ");

    return failedResult(
      "Website scrape returned no vehicles. Existing inventory was left unchanged." +
        (details ? ` Details: ${details}` : ""),
      Math.max(scrapeErrors.length, 1)
    );
  }

  let transformedVehicles: Awaited<
    ReturnType<typeof transformBatchToShiftlyVehicles>
  >;

  try {
    transformedVehicles = await transformBatchToShiftlyVehicles(
      scrapedVehicles,
      integration.dealership_id,
      integration.created_by
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    console.error(
      "[Website Sync] Vehicle transformation failed:",
      message
    );

    return failedResult(
      `Vehicle transformation failed: ${message}`,
      Math.max(scrapeErrors.length, 1)
    );
  }

  if (transformedVehicles.length === 0) {
    return failedResult(
      "Scraped vehicles could not be transformed. Existing inventory was left unchanged.",
      Math.max(scrapeErrors.length, 1)
    );
  }

  const supabase = createSupabaseAdminClient();

  const {
    data: existingVehicles,
    error: existingError,
  } = await supabase
    .from("vehicles")
    .select("id, vin")
    .eq("dealership_id", integration.dealership_id);

  if (existingError || !existingVehicles) {
    console.error(
      "[Website Sync] Existing inventory lookup failed:",
      existingError
    );

    return failedResult(
      "Failed to load existing vehicles. Sync aborted before inventory reconciliation.",
      1
    );
  }

  const existingVinSet = new Set(
    existingVehicles
      .map((vehicle) => vehicle.vin?.trim().toUpperCase())
      .filter((vin): vin is string => Boolean(vin))
  );

  let recordsCreated = 0;
  let recordsUpdated = 0;
  let recordsFailed = scrapeErrors.length;

  const scrapedVinSet = new Set<string>();

  // Save scraped vehicles first. Any failed write prevents SOLD
  // reconciliation for this run.
  for (const vehicle of transformedVehicles) {
    const vin = vehicle.vin?.trim().toUpperCase();

    if (!vin) {
      console.warn(
        "[Website Sync] Skipping vehicle without a VIN."
      );
      recordsFailed += 1;
      continue;
    }

    scrapedVinSet.add(vin);

    try {
      const {
        data: existingVehicle,
        error: lookupError,
      } = await supabase
        .from("vehicles")
        .select("id, primary_image, images")
        .eq("dealership_id", integration.dealership_id)
        .eq("vin", vin)
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

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
        currency: vehicle.currency ?? null,
        mileage: vehicle.mileage ?? null,
        mileage_unit: vehicle.mileage_unit ?? null,
        description: vehicle.description ?? null,
        location: vehicle.location ?? null,
        status: "AVAILABLE",
        primary_image: vehicle.primary_image ?? null,
        images: vehicle.images ?? [],
        created_by: integration.created_by,
        updated_at: new Date().toISOString(),
      };

      if (existingVehicle?.id) {
        const mergedImages = [
          ...new Set([
            ...(Array.isArray(existingVehicle.images)
              ? existingVehicle.images
                  .filter(
                    (image): image is string =>
                      typeof image === "string" &&
                      image.trim().length > 0
                  )
                  .map((image) => image.trim())
              : []),
            ...(Array.isArray(vehicle.images)
              ? vehicle.images
                  .filter(
                    (image): image is string =>
                      typeof image === "string" &&
                      image.trim().length > 0
                  )
                  .map((image) => image.trim())
              : []),
          ]),
        ];

        const primaryImage =
          typeof vehicle.primary_image === "string" &&
          vehicle.primary_image.trim()
            ? vehicle.primary_image.trim()
            : typeof existingVehicle.primary_image === "string" &&
                existingVehicle.primary_image.trim()
              ? existingVehicle.primary_image.trim()
              : mergedImages[0] ?? null;

        const { error: updateError } = await supabase
          .from("vehicles")
          .update({
            ...vehicleData,
            primary_image: primaryImage,
            images: mergedImages,
          })
          .eq("id", existingVehicle.id)
          .eq("dealership_id", integration.dealership_id);

        if (updateError) {
          throw updateError;
        }

        recordsUpdated += 1;
      } else {
        const { error: insertError } = await supabase
          .from("vehicles")
          .insert(vehicleData);

        if (insertError) {
          throw insertError;
        }

        recordsCreated += 1;
      }
    } catch (error) {
      recordsFailed += 1;

      console.error(
        `[Website Sync] Failed to save VIN ${vin}:`,
        error
      );
    }
  }

  let removedVehiclesCount = 0;

  // Reconcile only after a complete scrape and successful processing
  // of every transformed vehicle. Partial results must never mark
  // existing vehicles SOLD.
  if (scrapeComplete && recordsFailed === 0) {
    const removedVins = [...existingVinSet].filter(
      (vin) => !scrapedVinSet.has(vin)
    );

    for (const removedVin of removedVins) {
      try {
        const { error: updateError } = await supabase
          .from("vehicles")
          .update({
            status: "SOLD",
            updated_at: new Date().toISOString(),
          })
          .eq("dealership_id", integration.dealership_id)
          .eq("vin", removedVin);

        if (updateError) {
          throw updateError;
        }

        removedVehiclesCount += 1;
      } catch (error) {
        recordsFailed += 1;

        console.error(
          `[Website Sync] Failed to reconcile VIN ${removedVin}:`,
          error
        );
      }
    }
  } else {
    console.warn(
      "[Website Sync] Skipping SOLD reconciliation because the scrape was incomplete or vehicle processing had errors.",
      {
        scrapeComplete,
        recordsFailed,
      }
    );
  }

  const recordsProcessed =
    transformedVehicles.length + removedVehiclesCount;

  const successfulWrites = recordsCreated + recordsUpdated;

  const status: IntegrationSyncResult["status"] =
    recordsFailed > 0
      ? successfulWrites > 0 || removedVehiclesCount > 0
        ? "PARTIAL"
        : "FAILED"
      : !scrapeComplete
        ? "PARTIAL"
        : "SUCCESS";

  const errorMessages = [
    !scrapeComplete
      ? "Scrape was incomplete; missing vehicles were not marked SOLD."
      : null,
    scrapeErrors.length > 0
      ? `${scrapeErrors.length} scraping error(s).`
      : null,
    recordsFailed > scrapeErrors.length
      ? `${recordsFailed - scrapeErrors.length} vehicle or reconciliation operation(s) failed.`
      : null,
  ].filter((message): message is string => Boolean(message));

  console.log("[Website Sync] Final results:", {
    status,
    recordsProcessed,
    recordsCreated,
    recordsUpdated,
    recordsFailed,
    removedVehicles: removedVehiclesCount,
  });

  return {
    status,
    recordsProcessed,
    recordsCreated,
    recordsUpdated,
    recordsFailed,
    errorMessage:
      errorMessages.length > 0
        ? errorMessages.join(" ")
        : undefined,
  };
}
