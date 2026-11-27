import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";
import { requireSaasAccess } from "@/lib/saas";

export const runtime = "nodejs";

type SourceVehicle = {
  vin?: unknown;
  year?: unknown;
  make?: unknown;
  model?: unknown;
  trim?: unknown;
  bodyStyle?: unknown;
  drivetrain?: unknown;
  engine?: unknown;
  fuelType?: unknown;
  transmission?: unknown;
  exteriorColor?: unknown;
  interiorColor?: unknown;
  odometer?: unknown;
  initialPrice?: unknown;
  finalPrice?: unknown;
  calculatedFinalPrice?: unknown;
  vdpUrl?: unknown;
  sourceUrl?: unknown;
  description?: unknown;
  imageUrls?: unknown;
  images?: unknown;
};

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const result =
    typeof value === "string"
      ? Number(value.replace(/[$,\s]/g, ""))
      : Number(value);

  return Number.isFinite(result) ? result : null;
}

function textValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const valueTrimmed = value.trim();
  return valueTrimmed ? valueTrimmed : null;
}

function sourceUrlValue(value: unknown): string | null {
  const valueText = textValue(value);
  if (!valueText) return null;

  try {
    const url = new URL(valueText);
    if (
      url.protocol !== "https:" ||
      !(
        url.hostname === "tricitymits.com" ||
        url.hostname.endsWith(".tricitymits.com")
      )
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function imageValues(vehicle: SourceVehicle): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const visited = new WeakSet<object>();

  const imageKeys = [
    "image_original",
    "image_lg",
    "image_md",
    "image_sm",
    "image_xs",
    "image_url",
    "imageUrl",
    "large",
    "medium",
    "small",
    "extraSmall",
    "original",
    "thumbnail",
    "url",
    "src",
    "image",
    "images",
  ];

  function visit(value: unknown, depth = 0): void {
    if (depth > 6 || value == null || result.length >= 20) return;

    if (typeof value === "string") {
      const raw = value.trim();
      if (!raw) return;

      try {
        const url = new URL(
          raw.startsWith("//") ? `https:${raw}` : raw,
        );

        if (url.protocol !== "https:") return;

        const normalized = url.toString();

        if (!seen.has(normalized)) {
          seen.add(normalized);
          result.push(normalized);
        }
      } catch {
        // Ignore malformed or non-URL image values.
      }

      return;
    }

    if (typeof value !== "object") return;
    if (visited.has(value)) return;

    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, depth + 1);
        if (result.length >= 20) return;
      }

      return;
    }

    const record = value as Record<string, unknown>;

    for (const key of imageKeys) {
      if (!(key in record)) continue;

      visit(record[key], depth + 1);
      if (result.length >= 20) return;
    }
  }

  visit(vehicle.imageUrls);
  visit(vehicle.images);

  return result.slice(0, 20);
}

export async function POST(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        { success: false, error: "Sign in to Shiftly first." },
        { status: 401 },
      );
    }

    if (!["admin", "manager", "salesperson"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "You cannot import vehicles." },
        { status: 403 },
      );
    }

    let body: {
      source?: unknown;
      complete?: unknown;
      allPagesLoaded?: unknown;
      incomplete?: unknown;
      totalVehicles?: unknown;
      totalPages?: unknown;
      failedPages?: unknown;
      vehicles?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload." },
        { status: 400 },
      );
    }

    const vehicles = body.vehicles;

    if (
      body.source !== "tricitymits" ||
      body.complete !== true ||
      body.allPagesLoaded !== true ||
      body.incomplete === true ||
      !Array.isArray(vehicles) ||
      vehicles.length === 0 ||
      vehicles.length > 500 ||
      Number(body.totalVehicles) !== vehicles.length ||
      !Array.isArray(body.failedPages) ||
      body.failedPages.length !== 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "The saved inventory scan is incomplete or invalid.",
        },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data: existing, error: lookupError } = await supabase
      .from("vehicles")
      .select("vin,source_url")
      .eq("dealership_id", profile.dealership_id)
      .is("archived_at", null)
      .limit(10000);

    if (lookupError) {
      console.error("Tri-City duplicate lookup failed:", lookupError);
      return NextResponse.json(
        { success: false, error: "Could not check existing inventory." },
        { status: 500 },
      );
    }

    const existingVins = new Set(
      (existing ?? [])
        .map((row) => String(row.vin ?? "").trim().toUpperCase())
        .filter(Boolean),
    );

    const existingUrls = new Set(
      (existing ?? [])
        .map((row) => sourceUrlValue(row.source_url))
        .filter((value): value is string => Boolean(value)),
    );

    const seenVins = new Set<string>();
    const seenUrls = new Set<string>();
    const toInsert: Record<string, unknown>[] = [];
    const results: Array<{
      row: number;
      vin: string;
      status: "imported" | "skipped" | "error";
      reason?: string;
    }> = [];

    for (let index = 0; index < vehicles.length; index++) {
      const vehicle = vehicles[index] as SourceVehicle;
      const row = index + 1;
      const vin = String(vehicle?.vin ?? "").trim().toUpperCase();
      const sourceUrl = sourceUrlValue(vehicle?.sourceUrl ?? vehicle?.vdpUrl);

      const addError = (reason: string) => {
        results.push({ row, vin, status: "error", reason });
      };

      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        addError("Missing or invalid VIN; no VIN was generated.");
        continue;
      }

      if (existingVins.has(vin) || seenVins.has(vin)) {
        results.push({
          row,
          vin,
          status: "skipped",
          reason: "Duplicate VIN.",
        });
        continue;
      }

      if (
        sourceUrl &&
        (existingUrls.has(sourceUrl) || seenUrls.has(sourceUrl))
      ) {
        results.push({
          row,
          vin,
          status: "skipped",
          reason: "Source vehicle already exists.",
        });
        continue;
      }

      const year = numeric(vehicle.year);
      const make = textValue(vehicle.make);
      const model = textValue(vehicle.model);
      const price = numeric(
        vehicle.finalPrice ??
          vehicle.calculatedFinalPrice ??
          vehicle.initialPrice,
      );
      const mileage = numeric(vehicle.odometer);

      if (
        year === null ||
        !Number.isInteger(year) ||
        year < 1900 ||
        year > 2100 ||
        !make ||
        !model
      ) {
        addError("Invalid year, make, or model.");
        continue;
      }

      if (price !== null && price < 0) {
        addError("Invalid price.");
        continue;
      }

      if (
        mileage !== null &&
        (!Number.isInteger(mileage) || mileage < 0)
      ) {
        addError("Invalid odometer reading.");
        continue;
      }

      const images = imageValues(vehicle);

      toInsert.push({
        vin,
        year,
        make,
        model,
        trim: textValue(vehicle.trim),
        body: textValue(vehicle.bodyStyle),
        engine: textValue(vehicle.engine),
        drivetrain: textValue(vehicle.drivetrain),
        fuel: textValue(vehicle.fuelType),
        price,
        description: textValue(vehicle.description),
        status: "AVAILABLE",
        primary_image: images[0] ?? null,
        images,
        location: null,
        mileage,
        mileage_unit: "KM",
        currency: "CAD",
        transmission: textValue(vehicle.transmission),
        exterior_color: textValue(vehicle.exteriorColor),
        interior_color: textValue(vehicle.interiorColor),
        has_clean_title: null,
        condition: null,
        source_url: sourceUrl,
      });

      seenVins.add(vin);
      if (sourceUrl) seenUrls.add(sourceUrl);
    }

    if (toInsert.length > 0) {
      const saasAccess = await requireSaasAccess();

      if (!saasAccess.ok) {
        return NextResponse.json(
          { success: false, error: saasAccess.error },
          { status: saasAccess.status },
        );
      }

      // The database RPC derives user and dealership from auth.uid().
      // Do not pass client-supplied user or dealership identifiers.
      const { error: insertError } = await supabase.rpc(
        "insert_vehicles_atomic",
        { p_vehicles: toInsert },
      );

      if (insertError) {
        console.error("Tri-City atomic import failed:", insertError);

        const status =
          insertError.code === "42501" ||
          insertError.code === "23514"
            ? 403
            : insertError.code === "23505"
              ? 409
              : 500;

        return NextResponse.json(
          {
            success: false,
            error: insertError.message || "Atomic vehicle import failed.",
          },
          { status },
        );
      }

      for (const vehicle of toInsert) {
        results.push({
          row: vehicles.findIndex(
            (item) =>
              String((item as SourceVehicle)?.vin ?? "")
                .trim()
                .toUpperCase() === String(vehicle.vin),
          ) + 1,
          vin: String(vehicle.vin),
          status: "imported",
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        scanned: vehicles.length,
        imported: results.filter((item) => item.status === "imported").length,
        skipped: results.filter((item) => item.status === "skipped").length,
        errors: results.filter((item) => item.status === "error").length,
      },
      results: results.sort((a, b) => a.row - b.row),
    });
  } catch (error) {
    console.error("Tri-City import API error:", error);
    return NextResponse.json(
      { success: false, error: "Unexpected import error." },
      { status: 500 },
    );
  }
}
