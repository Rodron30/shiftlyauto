import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";
import { requireSaasAccess } from "@/lib/saas";

const LEAD_SELECT = `
  id,
  customer_id,
  customer_name,
  customer_phone,
  customer_email,
  interest_note,
  budget,
  financing_preference,
  status,
  follow_up_date,
  notes,
  created_at,
  updated_at,
  customer:customers(
    id,
    name,
    phone,
    email,
    notes
  ),
  vehicle:vehicles(
    vin,
    year,
    make,
    model,
    trim
  )
`;

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in to a dealership first.",
        },
        { status: 401 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_SELECT)
      .eq("dealership_id", profile.dealership_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Leads GET error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load leads.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        leads: data ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Leads API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in to a dealership first.",
        },
        { status: 401 }
      );
    }
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

    let body: {
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      customerId?: string;
      vehicleId?: string;
      interestNote?: string;
      budget?: number | string;
      financingPreference?: string;
      followUpDate?: string;
      notes?: string;
    };

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

    const customerName = String(
      body.customerName ?? ""
    ).trim();

    const customerPhone =
      body.customerPhone?.trim() || null;

    const customerEmail =
      body.customerEmail?.trim() || null;

    if (!customerName) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer name is required.",
        },
        { status: 400 }
      );
    }

    if (!customerPhone && !customerEmail) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide a phone number or an email address.",
        },
        { status: 400 }
      );
    }

    let budget: number | null = null;

    if (body.budget !== undefined && body.budget !== "") {
      budget = Number(
        String(body.budget).replace(/,/g, "")
      );

      if (!Number.isFinite(budget) || budget < 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Please enter a valid budget.",
          },
          { status: 400 }
        );
      }
    }

    const supabase = await createSupabaseServerClient();

    // ----------------------------------------------------------
    // 1. Validate explicitly selected customer, if supplied.
    // ----------------------------------------------------------

    let customerId: string | null =
      body.customerId?.trim() || null;

    if (customerId) {
      const { data: existingCustomer, error: customerError } =
        await supabase
          .from("customers")
          .select("id")
          .eq("id", customerId)
          .eq("dealership_id", profile.dealership_id)
          .maybeSingle();

      if (customerError || !existingCustomer) {
        return NextResponse.json(
          {
            success: false,
            error: "Selected customer was not found.",
          },
          { status: 400 }
        );
      }
    }

    // ----------------------------------------------------------
    // 2. If no customer was explicitly selected, try to find
    //    an existing customer by email or phone.
    // ----------------------------------------------------------

    if (!customerId) {
      if (customerEmail) {
        const { data: emailCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("dealership_id", profile.dealership_id)
          .eq("email", customerEmail)
          .limit(1)
          .maybeSingle();

        if (emailCustomer) {
          customerId = emailCustomer.id;
        }
      }
    }

    if (!customerId && customerPhone) {
      const { data: phoneCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("dealership_id", profile.dealership_id)
        .eq("phone", customerPhone)
        .limit(1)
        .maybeSingle();

      if (phoneCustomer) {
        customerId = phoneCustomer.id;
      }
    }

    // ----------------------------------------------------------
    // 3. Create a customer automatically when none exists.
    // ----------------------------------------------------------

    if (!customerId) {
      const { data: newCustomer, error: customerInsertError } =
        await supabase
          .from("customers")
          .insert({
            dealership_id: profile.dealership_id,
            name: customerName,
            phone: customerPhone,
            email: customerEmail,
            notes: body.notes?.trim() || null,
            created_by: profile.id,
          })
          .select("id")
          .single();

      if (customerInsertError || !newCustomer) {
        console.error(
          "Customer auto-create error:",
          customerInsertError
        );

        return NextResponse.json(
          {
            success: false,
            error: "Failed to create customer record.",
          },
          { status: 500 }
        );
      }

      customerId = newCustomer.id;
    } else {
      // --------------------------------------------------------
      // Keep the reusable customer record current with any
      // newly supplied contact information.
      // --------------------------------------------------------

      const customerUpdates: Record<string, string> = {};

      if (customerName) {
        customerUpdates.name = customerName;
      }

      if (customerPhone) {
        customerUpdates.phone = customerPhone;
      }

      if (customerEmail) {
        customerUpdates.email = customerEmail;
      }

      if (Object.keys(customerUpdates).length > 0) {
        customerUpdates.updated_at =
          new Date().toISOString();

        const { error: customerUpdateError } =
          await supabase
            .from("customers")
            .update(customerUpdates)
            .eq("id", customerId)
            .eq("dealership_id", profile.dealership_id);

        if (customerUpdateError) {
          console.error(
            "Customer sync error:",
            customerUpdateError
          );
        }
      }
    }

    // ----------------------------------------------------------
    // 4. Validate vehicle dealership ownership.
    // ----------------------------------------------------------

    if (body.vehicleId) {
      const { data: vehicle, error: vehicleError } =
        await supabase
          .from("vehicles")
          .select("id")
          .eq("id", body.vehicleId)
          .eq("dealership_id", profile.dealership_id)
          .maybeSingle();

      if (vehicleError || !vehicle) {
        return NextResponse.json(
          {
            success: false,
            error: "Selected vehicle was not found.",
          },
          { status: 400 }
        );
      }
    }

    // ----------------------------------------------------------
    // 5. Create lead and connect it to customer.
    // ----------------------------------------------------------

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        dealership_id: profile.dealership_id,
        customer_id: customerId,
        vehicle_id: body.vehicleId || null,
        interest_note:
          body.interestNote?.trim() || null,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        budget,
        financing_preference:
          body.financingPreference?.trim() || null,
        status: "NEW",
        follow_up_date:
          body.followUpDate || null,
        notes: body.notes?.trim() || null,
        created_by: profile.id,
      })
      .select(LEAD_SELECT)
      .single();

    if (error) {
      console.error("Lead insert error:", error);

      return NextResponse.json(
        {
          success: false,
          error:
            error.message || "Failed to save lead.",
        },
        { status: 500 }
      );
    }

    // ----------------------------------------------------------
    // 6. Record initial salesperson activity.
    // ----------------------------------------------------------

    const { error: activityError } =
      await supabase
        .from("salesperson_activities")
        .insert({
          dealership_id: profile.dealership_id,
          customer_id: customerId,
          lead_id: lead.id,
          user_id: profile.id,
          activity_type: "NOTE",
          description: "Lead created.",
          metadata: {
            source: "lead_creation",
          },
        });

    if (activityError) {
      // Lead creation should not fail just because activity
      // logging failed. Keep the primary CRM record intact.
      console.error(
        "Initial lead activity error:",
        activityError
      );
    }

    return NextResponse.json(
      {
        success: true,
        lead,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Lead POST error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}

