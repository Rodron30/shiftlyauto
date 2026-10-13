import { NextRequest, NextResponse } from "next/server";
import {
  validateSellCarForm,
  sanitizeSellCarData,
} from "@/lib/bcautoloan/validation/validators";
import { SellCarFormData } from "@/lib/bcautoloan/validation/schemas";
import { integrateWithCRM } from "@/lib/bcautoloan/integrations/crm";
import { checkRateLimit, getClientIdentifier } from "@/lib/bcautoloan/rateLimit";
import { randomBytes } from "crypto";
import { sendSellCarNotification } from "@/lib/bcautoloan/email";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate payload size (prevent large payloads)
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 10000) {
      // 10KB limit
      return NextResponse.json(
        { error: "Request payload too large" },
        { status: 413 }
      );
    }

    // Check honeypot field (spam protection)
    if (body.honeypot && body.honeypot !== "") {
      console.warn("Honeypot field filled - likely spam submission");
      return NextResponse.json(
        {
          success: true,
          referenceNumber: "HONEYPOT-DETECTED",
          message: "Vehicle information submitted successfully",
        },
        { status: 201 }
      );
    }

    // Rate limiting check
    const clientIdentifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(clientIdentifier, "sell-car");

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.resetAt
              ? Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000).toString()
              : "3600",
          },
        }
      );
    }

    // Validate and sanitize input
    const validationErrors = validateSellCarForm(body);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 }
      );
    }

    const sanitizedData = sanitizeSellCarData(body as SellCarFormData);

    // Validate required environment configuration
    const dealershipId = process.env.BCAUTOLOAN_DEALERSHIP_ID;
    const createdById = process.env.BCAUTOLOAN_CREATED_BY_USER_ID;

    if (!dealershipId) {
      console.error("BCAUTOLOAN_DEALERSHIP_ID is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    if (!createdById) {
      console.error("BCAUTOLOAN_CREATED_BY_USER_ID is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(dealershipId)) {
      console.error("Invalid BCAUTOLOAN_DEALERSHIP_ID format");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    if (!uuidRegex.test(createdById)) {
      console.error("Invalid BCAUTOLOAN_CREATED_BY_USER_ID format");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Generate reference number
    const referenceNumber = generateReferenceNumber();

    // CRM integration - this now creates the lead with correct vehicle information
    const vehicleInfo = {
      year: sanitizedData.year,
      make: sanitizedData.make,
      model: sanitizedData.model,
      trim: sanitizedData.trim,
      mileage: sanitizedData.mileage,
      condition: sanitizedData.condition,
      ownershipStatus: sanitizedData.ownershipStatus,
      vehicleLocation: sanitizedData.vehicleLocation,
      notes: sanitizedData.notes,
      preferredContactMethod: sanitizedData.preferredContactMethod,
    };

    const crmResult = await integrateWithCRM(
      dealershipId,
      sanitizedData.firstName,
      sanitizedData.lastName,
      sanitizedData.email,
      sanitizedData.phone,
      vehicleInfo,
      "0", // No budget for sell car submissions
      "SELL_CAR"
    );

    if (crmResult.error) {
      console.error("CRM integration failed:", crmResult.error);
      return NextResponse.json(
        { error: "Failed to process vehicle information" },
        { status: 500 }
      );
    }

    // Send notification after the CRM lead has been created.
    // Email failure does not invalidate the saved inquiry.
    const emailResult = await sendSellCarNotification({
      referenceNumber,
      firstName: sanitizedData.firstName,
      lastName: sanitizedData.lastName,
      email: sanitizedData.email,
      phone: sanitizedData.phone,
      year: sanitizedData.year,
      make: sanitizedData.make,
      model: sanitizedData.model,
      mileage: sanitizedData.mileage,
      condition: sanitizedData.condition,
    });

    if (!emailResult.success) {
      console.warn("Sell Your Car inquiry saved successfully, but notification email was not sent.");
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        referenceNumber: referenceNumber,
        message: "Vehicle information submitted successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Sell car API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function generateReferenceNumber(): string {
  // Generate a unique reference number using cryptographically secure randomness
  // Format: SC-YYYYMMDD-XXXXX
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomBytesBuffer = randomBytes(3);
  const randomStr = randomBytesBuffer.toString("hex").toUpperCase().substring(0, 5);
  return `SC-${dateStr}-${randomStr}`;
}

