import type {
  Integration,
  IntegrationSyncResult,
} from "./types";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { crawlInventory } from "@/lib/scraper/inventory-crawler";
import { transformBatchToShiftlyVehicles } from "@/lib/scraper/transformer";

export async function syncInventory(
  integration: Integration
): Promise<IntegrationSyncResult> {
  console.log(
    `[Inventory Sync] Started for integration ${integration.id}`
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

  try {
    const parsedUrl = new URL(inventoryUrl);

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

  let scrapedVehicles;
  let scrapeErrors;
  let scrapeComplete = false;

  try {
    const result = await crawlInventory(inventoryUrl, {
      maxVehicles,
      delayMs: 1000,
    });

    scrapedVehicles = result.vehicles;
    scrapeErrors = result.errors;
    scrapeComplete =
      result.complete && scrapeErrors.length === 0;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    console.error("[Inventory Sync] Crawl failed:", message);

    return failedResult(
      `Inventory crawl failed: ${message}`,
      1
    );
  }

  console.log("[Inventory Sync] Crawl results:", {
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
      "Inventory crawl returned no vehicles. Existing inventory was left unchanged." +
        (details ? ` Details: ${details}` : ""),
      Math.max(scrapeErrors.length, 1)
    );
  }

  let transformedVehicles;

  try {
    transformedVehicles =
      await transformBatchToShiftlyVehicles(
        scrapedVehicles,
        integration.dealership_id,
        integration.created_by
      );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    console.error(
      "[Inventory Sync] Transformation failed:",
      message
    );

    return failedResult(
      `Inventory transformation failed: ${message}`,
      Math.max(scrapeErrors.length, 1)
    );
  }

  if (transformedVehicles.length === 0) {
    return failedResult(
      "No vehicles could be transformed. Existing inventory was left unchanged.",
      Math.max(scrapeErrors.length, 1)
    );
  }

  const supabase = createSupabaseAdminClient();

  let recordsCreated = 0;
  let recordsUpdated = 0;
  let recordsFailed = scrapeErrors.length;

  for (const vehicle of transformedVehicles) {
    const vin = vehicle.vin?.trim().toUpperCase();

    if (!vin) {
      console.warn(
        "[Inventory Sync] Skipping vehicle without a VIN."
      );
      recordsFailed += 1;
      continue;
    }

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

      const incomingImages = Array.isArray(vehicle.images)
        ? vehicle.images
            .filter(
              (image): image is string =>
                typeof image === "string" &&
                image.trim().length > 0
            )
            .map((image) => image.trim())
        : [];

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
        images: incomingImages,
        created_by: integration.created_by,
        updated_at: new Date().toISOString(),
      };

      if (existingVehicle?.id) {
        const existingImages = Array.isArray(
          existingVehicle.images
        )
          ? existingVehicle.images
              .filter(
                (image): image is string =>
                  typeof image === "string" &&
                  image.trim().length > 0
              )
              .map((image) => image.trim())
          : [];

        const mergedImages = [
          ...new Set([...existingImages, ...incomingImages]),
        ];

        const primaryImage =
          typeof vehicle.primary_image === "string" &&
          vehicle.primary_image.trim()
            ? vehicle.primary_image.trim()
            : typeof existingVehicle.primary_image ===
                  "string" &&
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
        `[Inventory Sync] Failed to save VIN ${vin}:`,
        error
      );
    }
  }

  const successfulWrites = recordsCreated + recordsUpdated;

  const status: IntegrationSyncResult["status"] =
    recordsFailed > 0
      ? successfulWrites > 0
        ? "PARTIAL"
        : "FAILED"
      : !scrapeComplete
        ? "PARTIAL"
        : "SUCCESS";

  const errorMessages = [
    !scrapeComplete
      ? "Inventory crawl was incomplete; no vehicles were automatically marked SOLD."
      : null,
    scrapeErrors.length > 0
      ? `${scrapeErrors.length} scraping error(s).`
      : null,
    recordsFailed > scrapeErrors.length
      ? `${recordsFailed - scrapeErrors.length} vehicle save operation(s) failed.`
      : null,
  ].filter((message): message is string => Boolean(message));

  const result: IntegrationSyncResult = {
    status,
    recordsProcessed: transformedVehicles.length,
    recordsCreated,
    recordsUpdated,
    recordsFailed,
    errorMessage:
      errorMessages.length > 0
        ? errorMessages.join(" ")
        : undefined,
  };

  console.log("[Inventory Sync] Final results:", result);

  return result;
}
