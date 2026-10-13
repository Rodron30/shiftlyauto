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
  submissionType: SubmissionType = "PRE_APPROVAL"
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

    // Create or find customer (email-first, then phone)
    let customerId: string | null = null;

    const { data: existingCustomer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("dealership_id", dealershipId)
      .or(`email.eq.${email},phone.eq.${phone}`)
      .limit(1)
      .maybeSingle();

    if (customerError && customerError.code !== "PGRST116") {
      console.error("CRM customer lookup error:", customerError);
      return {
        customerId: null,
        leadId: null,
        error: "Failed to lookup customer",
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
          error: "Failed to create customer",
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
      customerNotes = `BCAutoLoan Pre-Approval Application - ${new Date().toLocaleDateString()}`;
    } else {
      // For SELL_CAR, include vehicle information in notes
      const vehicleInfo = applicationData;
      customerNotes = `BCAutoLoan Sell Your Car submission - ${new Date().toLocaleDateString()}\n\nVehicle Information:\n${JSON.stringify(vehicleInfo, null, 2)}`;
    }

    const financingPreference =
      submissionType === "PRE_APPROVAL" ? "Pre-Approval" : null;

    const budgetNumber = budget === "0" ? null : parseFloat(budget.replace(/[$,]/g, "")) || null;

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
        error: "Failed to create lead",
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
