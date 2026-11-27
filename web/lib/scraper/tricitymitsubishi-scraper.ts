import { request } from "undici";

export type TriCityScrapedVehicle = {
  vin: string | null;
  stock_number: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  body_style: string | null;
  vehicle_class: string | null;
  drive_train: string | null;
  engine: string | null;
  fuel_type: string | null;
  transmission: string | null;
  exterior_color: string | null;
  interior_color: string | null;
  odometer: number | null;
  asking_price: number | null;
  sale_price: number | null;
  internet_price: number | null;
  msrp: number | null;
  currency: string;
  vdp_url: string | null;
  images: string[];
  last_update_date_time: string | null;
};

const TRI_CITY_PROXY =
  "https://www.tricitymits.com/wp-content/plugins/convertus-vms/include/php/ajax-vehicles.php";

const CONVERTUS_API =
  "https://vms.prod.convertus.rocks/api/filtering/";

const INVENTORY_ID = "1868";

function buildEndpoint(page: number, pageSize: number): string {
  const params = new URLSearchParams({
    cp: INVENTORY_ID,
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

  return `${CONVERTUS_API}?${params.toString()}`;
}

function buildProxyUrl(endpoint: string): string {
  return `${TRI_CITY_PROXY}?endpoint=${encodeURIComponent(endpoint)}&action=vms_data`;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number(value.replace(/[^0-9.-]/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function extractImages(image: unknown): string[] {
  const urls = new Set<string>();
  const imageKeys = [
    "image_original",
    "image_lg",
    "image_md",
    "image_sm",
    "image_xs",
    "image_url",
    "imageUrl",
    "imageUrls",
    "image_urls",
    "primary_image",
    "primaryImage",
    "photo",
    "photos",
    "url",
    "src",
    "original",
    "large",
    "medium",
    "small",
    "thumbnail",
    "image",
    "images",
  ];

  const visit = (value: unknown, depth = 0): void => {
    if (value == null || depth > 6) {
      return;
    }

    if (typeof value === "string") {
      const candidate = value.trim();
      const normalized = candidate.startsWith("//")
        ? `https:${candidate}`
        : candidate;

      if (/^https?:\/\/[^\s"'<>]+$/i.test(normalized)) {
        urls.add(normalized);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, depth + 1);
      }
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    const source = value as Record<string, unknown>;
    for (const key of imageKeys) {
      if (key in source) {
        visit(source[key], depth + 1);
      }
    }
  };

  visit(image);
  return [...urls];
}

export async function scrapeTriCityMitsubishiPage(
  page = 1,
  pageSize = 15
): Promise<{
  vehicles: TriCityScrapedVehicle[];
  totalVehicles: number;
}> {
  const endpoint = buildEndpoint(page, pageSize);
  const proxyUrl = buildProxyUrl(endpoint);

  const response = await request(proxyUrl, {
    method: "GET",
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155 Safari/537.36",
      Referer: "https://www.tricitymits.com/vehicles/",
    },
  });

  if (response.statusCode !== 200) {
    throw new Error(
      `Tri-City Convertus proxy returned HTTP ${response.statusCode}`
    );
  }

  const rawText = await response.body.text();

  let payload: { results?: unknown; summary?: { total_vehicles?: unknown } };

  try {
    payload = JSON.parse(rawText) as { results?: unknown; summary?: { total_vehicles?: unknown } };
  } catch {
    throw new Error(
      `Tri-City Convertus proxy returned non-JSON content (${rawText.slice(0, 160)})`
    );
  }

  const results = Array.isArray(payload?.results)
    ? payload.results
    : [];

  const totalVehicles =
    toNumber(payload?.summary?.total_vehicles) ??
    results.length;

  const vehicles: TriCityScrapedVehicle[] = results
    .map((vehicle: Record<string, unknown>) => ({
      vin: toStringOrNull(vehicle.vin)?.toUpperCase() ?? null,
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
      ]),
      last_update_date_time: toStringOrNull(
        vehicle.last_update_date_time
      ),
    }))
    .filter((vehicle: TriCityScrapedVehicle) => Boolean(vehicle.vin));

  return {
    vehicles,
    totalVehicles,
  };
}


