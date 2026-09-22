import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

import {
  getSaasLimit,
  getSaasLimitError,
  requireSaasAccess,
} from "@/lib/saas";

const ALLOWED_STATUSES = ["AVAILABLE", "DRAFT", "SOLD"];

const EXPECTED_COLUMNS = [
  "vin",
  "year",
  "make",
  "model",
  "trim",
  "body",
  "engine",
  "drivetrain",
  "fuel",
  "price",
  "currency",
  "mileage",
  "status",
  "description",
  "exterior_color",
  "interior_color",
  "has_clean_title",
];

type RowResult = {
  row: number;
  vin: string;
  status: "imported" | "skipped" | "error";
  reason?: string;
};

/**
 * Minimal CSV parser â€” no external dependency, so importing this
 * feature doesn't require an `npm install` for everyone applying
 * this fix. Handles quoted fields (commas/quotes inside "...")
 * which covers the template this app generates. Not a general-
 * purpose CSV parser for arbitrary exports from other tools.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Normalize line endings so \r\n and \r both behave like \n.
  const input = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Flush the last field/row if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(
    (r) => !(r.length === 1 && r[0].trim() === "")
  );
}

export async function POST(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        {
          success: false,
          error: "You must be signed in to import vehicles.",
        },
        { status: 401 }
      );
    }

    // Customers cannot import vehicles
    if (profile.role === "customer") {
      return NextResponse.json(
        {
          success: false,
          error: "Customers do not have permission to import vehicles.",
        },
        { status: 403 }
      );
    }

    let body: { csv?: string };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON body.",
        },
        { status: 400 }
      );
    }

    const csvText = body.csv;

    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "No CSV content was provided.",
        },
        { status: 400 }
      );
    }

    const rows = parseCsv(csvText);

    if (rows.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The CSV needs a header row plus at least one vehicle row.",
        },
        { status: 400 }
      );
    }

    const header = rows[0].map((h) =>
      h.trim().toLowerCase()
    );

    const missingColumns = ["vin", "year", "make", "model"].filter(
      (col) => !header.includes(col)
    );

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required column(s): ${missingColumns.join(
            ", "
          )}. Expected columns: ${EXPECTED_COLUMNS.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const colIndex = (name: string) => header.indexOf(name);

    const dataRows = rows.slice(1);

    if (dataRows.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please import 500 vehicles or fewer at a time.",
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Load existing VINs for this dealership once, instead of a
    // query per row.
    const { data: existingVehicles, error: existingError } =
      await supabase
        .from("vehicles")
        .select("vin")
        .eq("dealership_id", profile.dealership_id)
        .is("archived_at", null);

    if (existingError) {
      console.error(
        "Import: existing VIN lookup error:",
        existingError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to check existing inventory.",
        },
        { status: 500 }
      );
    }

    const existingVins = new Set(
      (existingVehicles ?? []).map((v) => v.vin)
    );

    const results: RowResult[] = [];
    const toInsert: Record<string, unknown>[] = [];
    const seenInBatch = new Set<string>();

    dataRows.forEach((cells, index) => {
      const rowNumber = index + 2; // +1 for header, +1 for 1-based

      const get = (name: string) => {
        const i = colIndex(name);
        return i === -1 ? "" : (cells[i] ?? "").trim();
      };

      const vin = get("vin").toUpperCase();

      if (!vin) {
        results.push({
          row: rowNumber,
          vin: "",
          status: "error",
          reason: "Missing VIN.",
        });
        return;
      }

      if (vin.length !== 17) {
        results.push({
          row: rowNumber,
          vin,
          status: "error",
          reason: "VIN must be exactly 17 characters.",
        });
        return;
      }

      if (existingVins.has(vin) || seenInBatch.has(vin)) {
        results.push({
          row: rowNumber,
          vin,
          status: "skipped",
          reason: "VIN already exists.",
        });
        return;
      }

      const year = Number(get("year"));

      if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        results.push({
          row: rowNumber,
          vin,
          status: "error",
          reason: "Invalid year.",
        });
        return;
      }

      const make = get("make");
      const model = get("model");

      if (!make || !model) {
        results.push({
          row: rowNumber,
          vin,
          status: "error",
          reason: "Make and model are required.",
        });
        return;
      }

      const priceRaw = get("price").replace(/,/g, "");
      const price =
        priceRaw === "" ? null : Number(priceRaw);

      const currency = (get("currency").toUpperCase() || "USD").trim();
      const allowedCurrencies = [
        "USD",
        "PHP",
        "EUR",
        "GBP",
        "CAD",
        "AUD",
        "JPY",
        "CNY",
        "SGD",
        "HKD",
        "MYR",
        "THB",
        "IDR",
        "VND",
      ];

      if (currency && !allowedCurrencies.includes(currency)) {
        results.push({
          row: rowNumber,
          vin,
          status: "error",
          reason: `Invalid currency "${currency}". Use one of: ${allowedCurrencies.join(", ")}.`,
        });
        return;
      }

      if (
        price !== null &&
        (!Number.isFinite(price) || price < 0)
      ) {
        results.push({
          row: rowNumber,
          vin,
          status: "error",
          reason: "Invalid price.",
        });
        return;
      }

      const mileageRaw = get("mileage").replace(/,/g, "");
      const mileage =
        mileageRaw === "" ? null : Number(mileageRaw);

      if (
        mileage !== null &&
        (!Number.isFinite(mileage) ||
          !Number.isInteger(mileage) ||
          mileage < 0)
      ) {
        results.push({
          row: rowNumber,
          vin,
          status: "error",
          reason: "Invalid mileage.",
        });
        return;
      }

      const status =
        (get("status").toUpperCase() || "AVAILABLE").trim();

      if (!ALLOWED_STATUSES.includes(status)) {
        results.push({
          row: rowNumber,
          vin,
          status: "error",
          reason: `Invalid status "${status}". Use AVAILABLE, DRAFT, or SOLD.`,
        });
        return;
      }

      seenInBatch.add(vin);

      // Parse clean title boolean
      const hasCleanTitleRaw = get("has_clean_title").toLowerCase();
      let hasCleanTitle: boolean | null = null;
      if (hasCleanTitleRaw === "true" || hasCleanTitleRaw === "yes" || hasCleanTitleRaw === "1") {
        hasCleanTitle = true;
      } else if (hasCleanTitleRaw === "false" || hasCleanTitleRaw === "no" || hasCleanTitleRaw === "0") {
        hasCleanTitle = false;
      }

      toInsert.push({
        dealership_id: profile.dealership_id,
        vin,
        year,
        make,
        model,
        trim: get("trim") || null,
        body: get("body") || null,
        engine: get("engine") || null,
        drivetrain: get("drivetrain") || null,
        fuel: get("fuel") || null,
        price,
        currency: currency || "USD",
        mileage,
        description: get("description") || null,
        status,
        primary_image: null,
        exterior_color: get("exterior_color") || null,
        interior_color: get("interior_color") || null,
        has_clean_title: hasCleanTitle,
        created_by: profile.id,
      });

      // Log imported vehicle data for pipeline trace
      console.log("========== VEHICLE IMPORT DATA ==========");
      console.log("IMPORT: VIN =", vin);
      console.log("IMPORT: make =", make);
      console.log("IMPORT: model =", model);
      console.log("IMPORT: year =", year);
      console.log("IMPORT: body =", get("body"));
      console.log("IMPORT: exterior_color =", get("exterior_color"));
      console.log("IMPORT: interior_color =", get("interior_color"));
      console.log("IMPORT: has_clean_title =", hasCleanTitle);
      console.log("IMPORT: mileage =", mileage);
      console.log("IMPORT: fuel =", get("fuel"));
      console.log("IMPORT: transmission =", get("transmission"));
      console.log("==========================================");

      results.push({
        row: rowNumber,
        vin,
        status: "imported",
      });
    });

    if (toInsert.length > 0) {
      const saasAccess = await requireSaasAccess();

      if (!saasAccess.ok) {
        return NextResponse.json(
          {
            success: false,
            error: saasAccess.error,
          },
          { status: saasAccess.status }
        );
      }

      const vehicleLimit = getSaasLimit(
        saasAccess.context.plan,
        "vehicles"
      );

      if (vehicleLimit !== null) {
        const { count: activeVehicleCount, error: vehicleCountError } =
          await supabase
            .from("vehicles")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "dealership_id",
              profile.dealership_id
            )
            .is("archived_at", null);

        if (vehicleCountError) {
          console.error(
            "Import: SaaS vehicle count error:",
            vehicleCountError
          );

          return NextResponse.json(
            {
              success: false,
              error: "Failed to check vehicle plan limit.",
            },
            { status: 500 }
          );
        }

        const currentVehicleCount =
          activeVehicleCount ?? 0;

        if (
          currentVehicleCount + toInsert.length >
          vehicleLimit
        ) {
          return NextResponse.json(
            {
              success: false,
              error: getSaasLimitError(
                "Vehicle",
                vehicleLimit
              ),
            },
            { status: 403 }
          );
        }
      }

      const { error: insertError } = await supabase
        .from("vehicles")
        .insert(toInsert);

      if (insertError) {
        console.error(
          "Import: bulk insert error:",
          insertError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              insertError.message ||
              "Failed to import vehicles.",
          },
          { status: 500 }
        );
      }
    }

    const summary = {
      imported: results.filter((r) => r.status === "imported")
        .length,
      skipped: results.filter((r) => r.status === "skipped")
        .length,
      errors: results.filter((r) => r.status === "error").length,
    };

    return NextResponse.json(
      {
        success: true,
        summary,
        results,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Vehicle import API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error.",
      },
      { status: 500 }
    );
  }
}


