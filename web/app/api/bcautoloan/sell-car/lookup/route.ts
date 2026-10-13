import { NextRequest, NextResponse } from "next/server";

function isValidVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

function isValidCanadianPostalCode(postalCode: string): boolean {
  return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(postalCode);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const vin = String(body.vin || "")
      .trim()
      .toUpperCase()
      .replace(/\s/g, "");

    const postalCode = String(body.postalCode || "")
      .trim()
      .toUpperCase();

    if (!isValidVin(vin)) {
      return NextResponse.json(
        { error: "Enter a valid 17-character VIN." },
        { status: 400 }
      );
    }

    if (!isValidCanadianPostalCode(postalCode)) {
      return NextResponse.json(
        { error: "Enter a valid Canadian postal code." },
        { status: 400 }
      );
    }

    const url =
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/` +
      `${encodeURIComponent(vin)}?format=json`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to verify this VIN right now." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const result = data?.Results?.[0];

    if (!result) {
      return NextResponse.json(
        { error: "We could not find vehicle information for this VIN." },
        { status: 404 }
      );
    }

    const vehicle = {
      vin,
      postalCode,
      year: result.ModelYear || "",
      make: result.Make || "",
      model: result.Model || "",
      trim: result.Trim || result.Series || "",
      bodyClass: result.BodyClass || "",
      fuelType: result.FuelTypePrimary || "",
      driveType: result.DriveType || "",
      transmission: result.TransmissionStyle || "",
      engine:
        result.DisplacementL ||
        result.EngineCylinders ||
        "",
    };

    if (!vehicle.year || !vehicle.make || !vehicle.model) {
      return NextResponse.json(
        {
          error:
            "We found this VIN, but there is not enough vehicle information to continue.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      vehicle,
      message:
        "Vehicle verified. Continue to provide a few details so we can prepare your offer.",
    });
  } catch (error) {
    console.error("Sell car VIN lookup error:", error);

    return NextResponse.json(
      { error: "Unable to verify this VIN right now." },
      { status: 500 }
    );
  }
}
