import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export type SubmissionType = "PRE_APPROVAL" | "SELL_CAR";

export interface CRMIntegrationResult {
  customerId: string | null;
  leadId: string | null;
  error?: string;
}

/**
 * Integrates BCAutoLoan pre-approval or sell-car submissions with the existing Shiftly CRM.
 * This function uses the admin client to bypass authentication and directly
 * creates customers and leads on behalf of the public-facing BCAutoLoan website.
 *
 * IMPORTANT: This function validates that the configured created_by user
 * exists and belongs to the configured dealership before creating any records.
 *
 * @param dealershipId - The dealership ID (from BCAUTOLOAN_DEALERSHIP_ID)
 * @param firstName - Customer first name
 * @param lastName - Customer last name
 * @param email - Customer email
 * @param phone - Customer phone
 * @param applicationData - Additional application data to store in notes
 * @param budget - Vehicle budget (for pre-approval) or "0" (for sell-car)
 * @param submissionType - "PRE_APPROVAL" or "SELL_CAR"
 * @param applicationNumber - Optional application/reference number for duplicate detection
 * @returns Object with customer ID, lead ID, and optional error
 */
export async function integrateWithCRM(
  dealershipId: string | null,
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  applicationData: Record<string, unknown>,
  budget: string,
  submissionType: SubmissionType = "PRE_APPROVAL",
  applicationNumber?: string
): Promise<CRMIntegrationResult> {
  const supabase = createSupabaseAdminClient();

  // Validate required configuration
  const createdById = process.env.BCAUTOLOAN_CREATED_BY_USER_ID;

  if (!dealershipId) {
    return {
      customerId: null,
      leadId: null,
      error: "BCAUTOLOAN_DEALERSHIP_ID is not configured",
    };
  }

  if (!createdById) {
    return {
      customerId: null,
      leadId: null,
      error: "BCAUTOLOAN_CREATED_BY_USER_ID is not configured",
    };
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(dealershipId)) {
    return {
      customerId: null,
      leadId: null,
      error: "Invalid BCAUTOLOAN_DEALERSHIP_ID format",
    };
  }

  if (!uuidRegex.test(createdById)) {
    return {
      customerId: null,
      leadId: null,
      error: "Invalid BCAUTOLOAN_CREATED_BY_USER_ID format",
    };
  }

  try {
    // Verify the created_by user exists and belongs to the configured dealership
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, dealership_id")
      .eq("id", createdById)
      .single();

    if (userError || !user) {
      console.error("CRM integration: configured user not found", createdById);
      return {
        customerId: null,
        leadId: null,
        error: "Configured created_by user not found",
      };
    }

    if (user.dealership_id !== dealershipId) {
      console.error("CRM integration: user dealership mismatch", {
        userDealership: user.dealership_id,
        configuredDealership: dealershipId,
      });
      return {
        customerId: null,
        leadId: null,
        error: "Configured created_by user does not belong to configured dealership",
      };
    }

    const customerName = `${firstName} ${lastName}`;

    // Check for duplicate lead by application number to prevent creating multiple leads
    // for the same pre-approval submission (e.g., from page refresh or retry)
    // Uses exact match pattern with newline delimiter to avoid partial number collisions
    if (applicationNumber && submissionType === "PRE_APPROVAL") {
      const { data: existingLead, error: leadCheckError } = await supabase
        .from("leads")
        .select("id, customer_id, notes")
        .eq("dealership_id", dealershipId)
        .filter("notes", "ilike", `%Application Number: ${applicationNumber}\n%`)
        .limit(1)
        .maybeSingle();

      if (leadCheckError) {
        console.error("CRM duplicate lead check error:", leadCheckError);
        // Continue with normal flow if check fails - better to potentially create duplicate
        // than to block legitimate submissions
      } else if (existingLead) {
        // Verify the notes contain the exact application number format with newline
        // to avoid matching similar numbers (e.g., ABC12 vs ABC123)
        const exactMatchPattern = `Application Number: ${applicationNumber}\n`;
        if (existingLead.notes && existingLead.notes.includes(exactMatchPattern)) {
          console.log("CRM integration: existing lead found for application", applicationNumber);
          return {
            customerId: existingLead.customer_id,
            leadId: existingLead.id,
          };
        }
        // Pattern didn't match exactly, continue with normal flow
      }
    }

    // Match by exact email within this dealership to avoid ambiguous email/phone matches.
    let customerId: string | null = null;
    const normalizedEmail = email.trim().toLowerCase();

    const { data: existingCustomer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("dealership_id", dealershipId)
      .eq("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (customerError) {
      console.error("CRM customer lookup error:", customerError);
      return {
        customerId: null,
        leadId: null,
        error: `Failed to lookup customer [${customerError.code ?? "UNKNOWN"}]: ${customerError.message}`,
      };
    }

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      // Create new customer
      const { data: newCustomer, error: insertError } = await supabase
        .from("customers")
        .insert({
          dealership_id: dealershipId,
          name: customerName,
          email,
          phone,
          created_by: createdById,
        })
        .select("id")
        .single();

      if (insertError || !newCustomer) {
        console.error("CRM customer creation error:", insertError);
        return {
          customerId: null,
          leadId: null,
          error: `Failed to create customer [${insertError?.code ?? "UNKNOWN"}]: ${insertError?.message ?? "No customer record returned"}`,
        };
      }

      customerId = newCustomer.id;
    }

    // Create lead
    const interestNote =
      submissionType === "PRE_APPROVAL"
        ? "BCAutoLoan Pre-Approval Application"
        : "Sell Your Car submission";

    let customerNotes: string;
    if (submissionType === "PRE_APPROVAL") {
      const selectedBudget = String(
        applicationData.vehicleBudget ?? budget ?? "Not specified"
      );

      customerNotes =
        `BCAutoLoan Pre-Approval Application - ${new Date().toLocaleDateString()}\n` +
        (applicationNumber ? `Application Number: ${applicationNumber}\n` : "") +
        `Selected vehicle budget: ${selectedBudget}`;
    } else {
      // For SELL_CAR, include vehicle information in notes
      const vehicleInfo = applicationData;
      customerNotes = `BCAutoLoan Sell Your Car submission - ${new Date().toLocaleDateString()}\n` +
        (applicationNumber ? `Reference Number: ${applicationNumber}\n` : "") +
        `\nVehicle Information:\n${JSON.stringify(vehicleInfo, null, 2)}`;
    }

    const financingPreference =
      submissionType === "PRE_APPROVAL" ? "Pre-Approval" : null;

    const budgetNumber =
      submissionType === "PRE_APPROVAL"
        ? null
        : budget === "0"
          ? null
          : Number.parseFloat(String(budget ?? "").replace(/[$,]/g, "")) || null;

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        dealership_id: dealershipId,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: phone,
        customer_email: email,
        interest_note: interestNote,
        budget: budgetNumber,
        financing_preference: financingPreference,
        status: "NEW",
        notes: customerNotes,
        created_by: createdById,
      })
      .select("id")
      .single();

    if (leadError || !lead) {
      console.error("CRM lead creation error:", leadError);
      return {
        customerId,
        leadId: null,
        error: `Failed to create lead [${leadError?.code ?? "UNKNOWN"}]: ${leadError?.message ?? "No lead record returned"}`,
      };
    }

    return {
      customerId,
      leadId: lead.id,
    };
  } catch (error) {
    console.error("CRM integration exception:", error);
    return {
      customerId: null,
      leadId: null,
      error: "CRM integration failed",
    };
  }
}
