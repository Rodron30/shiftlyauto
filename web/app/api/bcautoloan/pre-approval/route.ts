import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  validatePreApprovalForm,
  sanitizePreApprovalData,
} from "@/lib/bcautoloan/validation/validators";
import { PreApprovalFormData } from "@/lib/bcautoloan/validation/schemas";
import { generatePreApprovalPDF } from "@/lib/bcautoloan/pdf/generator";
import { storePDFInStorage } from "@/lib/bcautoloan/pdf/storage";
import { integrateWithCRM } from "@/lib/bcautoloan/integrations/crm";
import { checkRateLimit, getClientIdentifier } from "@/lib/bcautoloan/rateLimit";
import { randomBytes } from "crypto";
import { sendPreApprovalNotification } from "@/lib/bcautoloan/email";

export async function POST(request: NextRequest) {
  try {
    // Enforce the payload limit before parsing JSON.
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null) {
      const parsedLength = Number(contentLength);
      if (!Number.isFinite(parsedLength) || parsedLength < 0) {
        return NextResponse.json(
          { error: "Invalid Content-Length header" },
          { status: 400 }
        );
      }
      if (parsedLength > 10000) {
        return NextResponse.json(
          { error: "Request payload too large" },
          { status: 413 }
        );
      }
    }

    // Enforce the limit even when Content-Length is absent.
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 10000) {
      return NextResponse.json(
        { error: "Request payload too large" },
        { status: 413 }
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;
    // Check honeypot field (spam protection)
    // If honeypot is filled, it's likely a bot - return success but don't process
    if (typeof payload.honeypot === "string" && payload.honeypot.trim() !== "") {
      console.warn("Honeypot field filled - likely spam submission");
      return NextResponse.json(
        {
          success: true,
          applicationNumber: "HONEYPOT-DETECTED",
          message: "Application submitted successfully",
        },
        { status: 201 }
      );
    }

    // Rate limiting check
    const clientIdentifier = getClientIdentifier(request);

    if (!clientIdentifier) {
      console.error("[PreApproval] Unable to determine client identifier for rate limiting");
      return NextResponse.json(
        { error: "We couldn't verify your request. Please try again shortly." },
        { status: 503 }
      );
    }

    const rateLimitResult = await checkRateLimit(clientIdentifier, "pre-approval");

    if (rateLimitResult.error) {
      console.error("[PreApproval] Rate limit service unavailable:", rateLimitResult.error);
      return NextResponse.json(
        { error: "We couldn't verify your request right now. Please try again shortly." },
        { status: 503 }
      );
    }

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
    const validationErrors = validatePreApprovalForm(payload as Partial<PreApprovalFormData>);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 }
      );
    }

    const sanitizedData = sanitizePreApprovalData(payload as unknown as PreApprovalFormData);

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

    // Generate application number
    const applicationNumber = generateApplicationNumber();

    // Create Supabase admin client (server-side only)
    const supabase = createSupabaseAdminClient();

    // Insert application into database
    const { data: application, error: insertError } = await supabase
      .from("pre_approval_applications")
      .insert({
        application_number: applicationNumber,
        dealership_id: dealershipId,
        first_name: sanitizedData.firstName,
        last_name: sanitizedData.lastName,
        email: sanitizedData.email,
        phone: sanitizedData.phone,
        address: sanitizedData.address,
        city: sanitizedData.city,
        province: sanitizedData.province,
        postal_code: sanitizedData.postalCode,
        employment_status: sanitizedData.employmentStatus,
        employer: sanitizedData.employer,
        job_title: sanitizedData.jobTitle,
        income: sanitizedData.income,
        income_frequency: sanitizedData.incomeFrequency,
        vehicle_type: sanitizedData.vehicleType,
        vehicle_make: sanitizedData.vehicleMake,
        vehicle_model: sanitizedData.vehicleModel,
        vehicle_budget: sanitizedData.vehicleBudget,
        down_payment: sanitizedData.downPayment,
        has_trade: sanitizedData.hasTrade,
        application_data: sanitizedData,
        source: "BCAutoLoan",
        status: "SUBMITTED",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insertion error:", insertError);
      return NextResponse.json(
        { error: "Failed to save application" },
        { status: 500 }
      );
    }

    // Phase 6 - Generate PDF and store in Supabase Storage
    // PDF generation failure should not cause the application to fail
    let pdfPath: string | null = null;
    try {
      const pdfData = {
        applicationNumber: applicationNumber,
        submissionDate: new Date(),
        firstName: sanitizedData.firstName,
        lastName: sanitizedData.lastName,
        dateOfBirth: sanitizedData.dateOfBirth,
        email: sanitizedData.email,
        phone: sanitizedData.phone,
        address: sanitizedData.address,
        city: sanitizedData.city,
        province: sanitizedData.province,
        postalCode: sanitizedData.postalCode,
        employmentStatus: sanitizedData.employmentStatus,
        employer: sanitizedData.employer,
        jobTitle: sanitizedData.jobTitle,
        income: sanitizedData.income,
        incomeFrequency: sanitizedData.incomeFrequency,
        vehicleType: sanitizedData.vehicleType,
        vehicleMake: sanitizedData.vehicleMake,
        vehicleModel: sanitizedData.vehicleModel,
        vehicleBudget: sanitizedData.vehicleBudget,
        downPayment: sanitizedData.downPayment,
        hasTrade: sanitizedData.hasTrade,
      };

      const pdfBytes = await generatePreApprovalPDF(pdfData);

      // Store PDF in Supabase Storage
      const storageResult = await storePDFInStorage(applicationNumber, pdfBytes);

      if (storageResult.success && storageResult.path) {
        pdfPath = storageResult.path;

        // Update application with PDF reference
        const { error: pdfUpdateError } = await supabase
          .from("pre_approval_applications")
          .update({
            pdf_path: pdfPath,
            pdf_generated_at: new Date().toISOString(),
          })
          .eq("id", application.id);

        if (pdfUpdateError) {
          console.error("PDF path update error:", pdfUpdateError);
          // Don't fail the submission, just log the error
        }
      } else {
        console.warn("PDF storage failed:", storageResult.error);
        // Don't fail the submission, just log the error
      }
    } catch (error) {
      console.error("PDF generation error:", error);
      // Don't fail the submission, just log the error
    }

    // Phase 7 - Connect to existing Shiftly CRM
    // CRM integration failure should not cause the application to fail
    let customerId: string | null = null;
    let leadId: string | null = null;
    let crmError: string | null = null;
    try {
      const crmResult = await integrateWithCRM(
        dealershipId,
        sanitizedData.firstName,
        sanitizedData.lastName,
        sanitizedData.email,
        sanitizedData.phone,
        sanitizedData as unknown as Record<string, unknown>,
        sanitizedData.vehicleBudget,
        "PRE_APPROVAL",
        applicationNumber
      );

      if (!crmResult.error && crmResult.customerId && crmResult.leadId) {
        customerId = crmResult.customerId;
        leadId = crmResult.leadId;

        // Update application with CRM references
        const { error: crmUpdateError } = await supabase
          .from("pre_approval_applications")
          .update({
            customer_id: customerId,
            lead_id: leadId,
            status: "RECEIVED",
          })
          .eq("id", application.id);

        if (crmUpdateError) {
          console.error("Pre-approval CRM link update failed:", {
            applicationNumber,
            applicationId: application.id,
            customerId,
            leadId,
            error: crmUpdateError,
          });
          crmError = "Failed to link CRM records to application";
          // Don't fail the submission, just log the error
        }
        // If crmUpdateError is null, CRM integration succeeded (crmError remains null)
      } else {
        // Sanitize error message before returning to client
        crmError = crmResult.error
          ? "CRM synchronization failed. Please check server logs for details."
          : "Missing customer or lead ID from CRM integration";
        console.error("Pre-approval CRM integration failed:", {
          applicationNumber,
          applicationId: application.id,
          customerId: crmResult.customerId,
          leadId: crmResult.leadId,
          originalError: crmResult.error,
        });
        // Don't fail the submission, just log the error
      }
    } catch (error) {
      crmError = "CRM synchronization encountered an unexpected error";
      console.error("Pre-approval CRM integration exception:", {
        applicationNumber,
        applicationId: application.id,
        error,
      });
      // Don't fail the submission, just log the error
    }

    // Send notification email after the application and CRM records are complete.
    // Email failure does not invalidate the saved application.
    let emailSent = false;
    try {
      const emailResult = await sendPreApprovalNotification({
        applicationNumber,
        firstName: sanitizedData.firstName,
        lastName: sanitizedData.lastName,
        dateOfBirth: sanitizedData.dateOfBirth,
        email: sanitizedData.email,
        phone: sanitizedData.phone,
        address: sanitizedData.address,
        city: sanitizedData.city,
        province: sanitizedData.province,
        postalCode: sanitizedData.postalCode,
        employmentStatus: sanitizedData.employmentStatus,
        employer: sanitizedData.employer,
        jobTitle: sanitizedData.jobTitle,
        income: sanitizedData.income,
        incomeFrequency: sanitizedData.incomeFrequency,
        vehicleType: sanitizedData.vehicleType,
        vehicleMake: sanitizedData.vehicleMake,
        vehicleModel: sanitizedData.vehicleModel,
        vehicleBudget: sanitizedData.vehicleBudget,
      });

      emailSent = emailResult.success;

      if (!emailResult.success) {
        console.warn(
          "Pre-approval saved successfully, but notification email was not sent:",
          emailResult.error ?? "Unknown notification error"
        );
      }
    } catch (emailError) {
      console.error(
        "Pre-approval saved successfully, but notification email threw an exception:",
        emailError instanceof Error ? emailError.message : "Unknown email error"
      );
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        applicationNumber: applicationNumber,
        message: "Application submitted successfully",
        crmLinked: customerId !== null && leadId !== null && crmError === null,
        crmError: crmError,
        emailSent: emailSent,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Pre-approval API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function generateApplicationNumber(): string {
  // Generate a unique application number using cryptographically secure randomness
  // Format: BC-YYYYMMDD-XXXXX
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomBytesBuffer = randomBytes(3);
  const randomStr = randomBytesBuffer.toString("hex").toUpperCase().substring(0, 5);
  return `BC-${dateStr}-${randomStr}`;
}



