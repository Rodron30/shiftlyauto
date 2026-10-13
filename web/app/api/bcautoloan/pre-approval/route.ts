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
    // If honeypot is filled, it's likely a bot - return success but don't process
    if (body.honeypot && body.honeypot !== "") {
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
    const rateLimitResult = await checkRateLimit(clientIdentifier, "pre-approval");

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
    const validationErrors = validatePreApprovalForm(body);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 }
      );
    }

    const sanitizedData = sanitizePreApprovalData(body as PreApprovalFormData);

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
    try {
      const crmResult = await integrateWithCRM(
        dealershipId,
        sanitizedData.firstName,
        sanitizedData.lastName,
        sanitizedData.email,
        sanitizedData.phone,
        sanitizedData as unknown as Record<string, unknown>,
        sanitizedData.vehicleBudget,
        "PRE_APPROVAL"
      );

      if (!crmResult.error) {
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
          console.error("CRM update error:", crmUpdateError);
          // Don't fail the submission, just log the error
        }
      } else {
        console.warn("CRM integration failed:", crmResult.error);
        // Don't fail the submission, just log the error
      }
    } catch (error) {
      console.error("CRM integration error:", error);
      // Don't fail the submission, just log the error
    }

    // Send notification email after the application and CRM records are complete.
    // Email failure does not invalidate the saved application.
    const emailResult = await sendPreApprovalNotification({
      applicationNumber,
      firstName: sanitizedData.firstName,
      lastName: sanitizedData.lastName,
      email: sanitizedData.email,
      phone: sanitizedData.phone,
      vehicleType: sanitizedData.vehicleType,
      vehicleMake: sanitizedData.vehicleMake,
      vehicleModel: sanitizedData.vehicleModel,
      vehicleBudget: sanitizedData.vehicleBudget,
    });

    if (!emailResult.success) {
      console.warn("Pre-approval saved successfully, but notification email was not sent.");
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        applicationNumber: applicationNumber,
        message: "Application submitted successfully",
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



