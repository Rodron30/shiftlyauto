import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { fetchAllTriCityInventory } from "./tricity-inventory-fetcher";
import { transformTriCityVehicles } from "./tricity-transformer";
import type { TriCityFeedTransport } from "./tricitymits-feed";
import { TriCityHttpFeedTransport } from "./tricity-http-feed";
import type { TriCityScrapedVehicle } from "./tricitymitsubishi-scraper";
import type { TriCitySyncResult } from "./tricity-sync";

const DEFAULT_TRANSPORT: TriCityFeedTransport =
  new TriCityHttpFeedTransport();

type TriCitySyncConfig = {
  feedUrl: string;
  pageSize: number;
  maxVehicles: number;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value.replace(/[^0-9.-]/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function extractImages(value: unknown): string[] {
  const result: string[] = [];
  const seenUrls = new Set<string>();
  const visited = new WeakSet<object>();

  const visit = (item: unknown, depth = 0): void => {
    if (depth > 8 || item == null || result.length >= 50) return;

    if (typeof item === "string") {
      const candidate = item.trim();
      if (!candidate) return;

      const normalized = candidate.startsWith("//")
        ? `https:${candidate}`
        : candidate;

      try {
        const parsed = new URL(normalized);

        if (
          (parsed.protocol === "https:" || parsed.protocol === "http:") &&
          !seenUrls.has(normalized)
        ) {
          seenUrls.add(normalized);
          result.push(normalized);
        }
      } catch {
        // Ignore non-URL strings.
      }

      return;
    }

    if (typeof item !== "object") return;
    if (visited.has(item)) return;
    visited.add(item);

    if (Array.isArray(item)) {
      for (const entry of item) {
        visit(entry, depth + 1);
        if (result.length >= 50) return;
      }
      return;
    }

    for (const nested of Object.values(item as Record<string, unknown>)) {
      visit(nested, depth + 1);
      if (result.length >= 50) return;
    }
  };

  visit(value);
  return result;
}

function normalizeVehicle(value: unknown): TriCityScrapedVehicle | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const vehicle = value as Record<string, unknown>;
  const vin = toStringOrNull(vehicle.vin)?.toUpperCase();

  if (!vin) {
    return null;
  }

  return {
    vin,
    stock_number: toStringOrNull(vehicle.stock_number),
    year: toNumber(vehicle.year),
    make: toStringOrNull(vehicle.make),
    model: toStringOrNull(vehicle.model),
    trim: toStringOrNull(vehicle.trim),
    body_style: toStringOrNull(vehicle.body_style),
    vehicle_class: toStringOrNull(vehicle.vehicle_class),
    drive_train: toStringOrNull(vehicle.drive_train),
    engine: toStringOrNull(vehicle.engine),
    fuel_type: toStringOrNull(vehicle.fuel_type),
    transmission: toStringOrNull(vehicle.transmission),
    exterior_color: toStringOrNull(vehicle.exterior_color),
    interior_color: toStringOrNull(vehicle.interior_color),
    odometer: toNumber(vehicle.odometer),
    asking_price: toNumber(vehicle.asking_price),
    sale_price: toNumber(vehicle.sale_price),
    internet_price: toNumber(vehicle.internet_price),
    msrp: toNumber(vehicle.msrp),
    currency: "CAD",
    vdp_url: toStringOrNull(vehicle.vdp_url),
    images: extractImages([
      vehicle.image,
      vehicle.images,
      vehicle.image_original,
      vehicle.image_lg,
      vehicle.image_md,
      vehicle.image_sm,
      vehicle.image_xs,
      vehicle.image_url,
      vehicle.imageUrl,
      vehicle.imageUrls,
      vehicle.image_urls,
      vehicle.primary_image,
      vehicle.primaryImage,
      vehicle.photo,
      vehicle.photos,
    ]),
    last_update_date_time:
      toStringOrNull(vehicle.last_update_date_time),
  };
}

function buildEndpoint(
  feedUrl: string,
  page: number,
  pageSize: number,
): string {
  let url: URL;

  try {
    url = new URL(feedUrl);
  } catch {
    throw new Error("Tri-City feed URL is invalid.");
  }

  const allowedFeedHost =
    url.hostname === "vms.prod.convertus.rocks" ||
    url.hostname === "tricitymits.com" ||
    url.hostname.endsWith(".tricitymits.com");

  if (url.protocol !== "https:" || !allowedFeedHost) {
    throw new Error(
      "Tri-City feed URL must use HTTPS and an approved Tri-City or Convertus host.",
    );
  }

  const hasPagePlaceholder =
    url.href.includes("{page}") ||
    url.href.includes("{pageSize}");

  if (hasPagePlaceholder) {
    return url.href
      .replaceAll("{page}", String(page))
      .replaceAll("{pageSize}", String(pageSize));
  }

  if (
    url.hostname === "vms.prod.convertus.rocks" &&
    url.pathname.replace(new RegExp("/+$"), "") === "/api/filtering"
  ) {
    const params = new URLSearchParams({
      cp: "1868",
      ln: "en",
      pg: String(page),
      pc: String(pageSize),
      dc: "true",
      qs: "",
      im: "true",
      svs: "",
      sc: "used",
      v1: "",
      st: "",
      ai: "true",
      oem: "Mitsubishi",
      dp: "",
      in_transit: "true",
      in_stock: "true",
      on_order: "true",
      sn: "",
      mk: "inventory",
      view: "grid",
      defaultParams: "",
      pnpi: "reta",
      pnpm: "inte",
      pnpf: "inte",
      pupi: "reta",
      pupm: "none",
      pupf: "inte",
      nnpi: "inte",
      nnpm: "inte",
      nnpf: "inte",
      nupi: "none",
      nupm: "none",
      nupf: "inte",
      po: "fixed",
    });

    const endpoint = `${url.origin}${url.pathname}?${params.toString()}`;

    const proxyUrl = new URL(
      "https://www.tricitymits.com/wp-content/plugins/convertus-vms/include/php/ajax-vehicles.php",
    );

    proxyUrl.searchParams.set("endpoint", endpoint);
    proxyUrl.searchParams.set("action", "vms_data");

    return proxyUrl.toString();
  }

  url.searchParams.set("pg", String(page));
  url.searchParams.set("pc", String(pageSize));

  return url.toString();
}
export async function syncTriCityInventory(
  dealershipId: string,
  createdBy: string,
  config: TriCitySyncConfig,
  transport: TriCityFeedTransport = DEFAULT_TRANSPORT,
): Promise<TriCitySyncResult> {
  const startedAt = new Date().toISOString();

  const stats = {
    fetched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    removed: 0,
    errors: 0,
  };

  const errors: string[] = [];

  try {
    if (!dealershipId) {
      throw new Error("Tri-City sync requires a dealership ID.");
    }

    if (!createdBy) {
      throw new Error("Tri-City sync requires a created_by user.");
    }

    if (!config.feedUrl.trim()) {
      throw new Error("Tri-City authorized feed URL is not configured.");
    }

    const collected = await fetchAllTriCityInventory(
      (page, pageSize) =>
        buildEndpoint(config.feedUrl, page, pageSize),
      config.pageSize,
      config.maxVehicles,
      transport,
    );

    if (collected.invalidRecordCount > 0) {
      throw new Error(
        `Tri-City preflight failed: ${collected.invalidRecordCount} feed record(s) have no valid VIN. No database writes were attempted.`,
      );
    }

    if (!collected.complete) {
      throw new Error(
        `Tri-City preflight failed: inventory fetch is incomplete (${collected.results.length} unique VIN-bearing records collected across ${collected.pagesFetched} page(s)). No database writes were attempted.`,
      );
    }

    const normalizedResults = collected.results.map(normalizeVehicle);
    const invalidRecordCount = normalizedResults.filter(
      (vehicle) => vehicle === null,
    ).length;

    if (invalidRecordCount > 0) {
      throw new Error(
        `Tri-City preflight failed: ${invalidRecordCount} feed record(s) have no valid VIN or could not be normalized. No database writes were attempted.`,
      );
    }

    const scrapedVehicles =
      normalizedResults as TriCityScrapedVehicle[];

    stats.fetched = scrapedVehicles.length;

    if (scrapedVehicles.length === 0) {
      throw new Error(
        "Tri-City sync returned no VIN-bearing vehicles. No database writes were attempted.",
      );
    }

    const scrapedVinCounts = new Map<string, number>();

    for (const vehicle of scrapedVehicles) {
      const rawVin = vehicle.vin;

      if (typeof rawVin !== "string" || !rawVin.trim()) {
        throw new Error(
          "Tri-City preflight failed: a normalized record has no valid VIN. No database writes were attempted.",
        );
      }

      const vin = rawVin.trim().toUpperCase();
      scrapedVinCounts.set(
        vin,
        (scrapedVinCounts.get(vin) ?? 0) + 1,
      );
    }

    const duplicateScrapedVins = [...scrapedVinCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([vin]) => vin);

    if (duplicateScrapedVins.length > 0) {
      throw new Error(
        `Tri-City preflight failed: duplicate VIN(s) in feed: ${duplicateScrapedVins.slice(0, 10).join(", ")}. No database writes were attempted.`,
      );
    }

    const transformed = transformTriCityVehicles(
      scrapedVehicles,
      dealershipId,
      createdBy,
    );

    const supabase = createSupabaseAdminClient();

    const existingVehicles: Array<{
      id: string;
      vin: string | null;
      status: string | null;
      primary_image: string | null;
      images: unknown;
      source_url: string | null;
    }> = [];

    const existingBatchSize = 500;
    let existingOffset = 0;

    while (true) {
      const { data: batch, error: batchError } = await supabase
        .from("vehicles")
        .select("id, vin, status, primary_image, images, source_url")
        .eq("dealership_id", dealershipId)
        .not("vin", "is", null)
        .order("id", { ascending: true })
        .range(existingOffset, existingOffset + existingBatchSize - 1);

      if (batchError) {
        throw batchError;
      }

      const rows = batch ?? [];
      existingVehicles.push(...rows);

      if (rows.length < existingBatchSize) {
        break;
      }

      existingOffset += existingBatchSize;
    }

    const existing = (existingVehicles ?? [])
      .map((vehicle) => ({
        id: vehicle.id as string,
        vin: String(vehicle.vin).trim().toUpperCase(),
        status: vehicle.status as string | null,
        primary_image: vehicle.primary_image as string | null,
        images: Array.isArray(vehicle.images) ? vehicle.images : [],
        source_url:
          typeof vehicle.source_url === "string" ? vehicle.source_url : null,
      }))
      .filter((vehicle) => Boolean(vehicle.vin));

    const isTriCitySourceUrl = (value: string | null): boolean => {
      if (!value) return false;

      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          (url.hostname === "tricitymits.com" ||
            url.hostname.endsWith(".tricitymits.com"))
        );
      } catch {
        return false;
      }
    };

    const triCityExisting = existing.filter((vehicle) =>
      isTriCitySourceUrl(vehicle.source_url),
    );

    const triCityCountsByVin = new Map<string, number>();

    for (const vehicle of triCityExisting) {
      triCityCountsByVin.set(
        vehicle.vin,
        (triCityCountsByVin.get(vehicle.vin) ?? 0) + 1,
      );
    }

    const duplicateTriCityVins = new Set(
      [...triCityCountsByVin.entries()]
        .filter(([, count]) => count > 1)
        .map(([vin]) => vin),
    );

    for (const vin of duplicateTriCityVins) {
      stats.errors += 1;
      errors.push(
        `VIN ${vin}: multiple Tri-City records detected; manual review required.`,
      );
    }

    const existingByVin = new Map(
      triCityExisting
        .filter((vehicle) => !duplicateTriCityVins.has(vehicle.vin))
        .map((vehicle) => [vehicle.vin, vehicle]),
    );

    const otherSourceVins = new Set(
      existing
        .filter(
          (vehicle) => !isTriCitySourceUrl(vehicle.source_url),
        )
        .map((vehicle) => vehicle.vin),
    );

    for (const vehicle of transformed) {
      const vin = vehicle.vin?.trim().toUpperCase();

      if (!vin) {
        stats.errors += 1;
        errors.push("Skipped Tri-City vehicle without VIN.");
        continue;
      }

      const vehicleData = {
        dealership_id: dealershipId,
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
        currency: vehicle.currency ?? "CAD",
        mileage: vehicle.mileage ?? null,
        mileage_unit: vehicle.mileage_unit ?? "KM",
        description: vehicle.description ?? null,
        location: vehicle.location ?? null,
        status: "AVAILABLE",
        primary_image: vehicle.primary_image ?? null,
        images: vehicle.images ?? [],
        source_url: vehicle.source_url ?? null,
        created_by: createdBy,
        updated_at: new Date().toISOString(),
      };

      const existingVehicle = existingByVin.get(vin);

      if (
        otherSourceVins.has(vin) ||
        duplicateTriCityVins.has(vin)
      ) {
        stats.errors += 1;
        errors.push(
          `Skipped VIN ${vin}: source collision or duplicate ownership record requires manual review.`,
        );
        continue;
      }

      if (existingVehicle?.id) {
        const mergedImages = [
          ...new Set([
            ...(Array.isArray(existingVehicle.images)
              ? existingVehicle.images
                  .filter(
                    (image): image is string =>
                      typeof image === "string" && image.trim().length > 0,
                  )
                  .map((image) => image.trim())
              : []),
            ...(Array.isArray(vehicle.images)
              ? vehicle.images
                  .filter(
                    (image): image is string =>
                      typeof image === "string" && image.trim().length > 0,
                  )
                  .map((image) => image.trim())
              : []),
          ]),
        ];

        const { error } = await supabase
          .from("vehicles")
          .update({
            ...vehicleData,
            status: existingVehicle.status ?? vehicleData.status,
            source_url: vehicle.source_url ?? existingVehicle.source_url,
            primary_image:
              typeof vehicle.primary_image === "string" &&
              vehicle.primary_image.trim()
                ? vehicle.primary_image.trim()
                : typeof existingVehicle.primary_image === "string" &&
                    existingVehicle.primary_image.trim()
                  ? existingVehicle.primary_image.trim()
                  : mergedImages[0] ?? null,
            images: mergedImages,
          })
          .eq("id", existingVehicle.id)
          .eq("dealership_id", dealershipId);
        if (error) {
          stats.errors += 1;
          errors.push(`Update failed for VIN ${vin}: ${error.message}`);
          continue;
        }

        stats.updated += 1;
      } else {
        const { error } = await supabase
          .from("vehicles")
          .insert(vehicleData);

        if (error) {
          stats.errors += 1;
          errors.push(`Create failed for VIN ${vin}: ${error.message}`);
          continue;
        }

        stats.created += 1;
      }
    }

    // SAFETY: Missing feed records are not proof that vehicles were sold.
    // Preserve existing records and statuses; removal requires explicit review.
    const finishedAt = new Date().toISOString();

    return {
      success: stats.errors === 0,
      complete: collected.complete,
      startedAt,
      finishedAt,
      stats,
      errors,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Tri-City sync error.";

    errors.push(message);
    stats.errors += 1;

    return {
      success: false,
      complete: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      stats,
      errors,
    };
  }
}

