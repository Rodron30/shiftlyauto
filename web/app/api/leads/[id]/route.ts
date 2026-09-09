import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";
import { requireSaasAccess } from "@/lib/saas";

const ALLOWED_STATUSES = [
  "NEW",
  "CONTACTED",
  "NEGOTIATING",
  "WON",
  "LOST",
];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type LeadRecord = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  interest_note: string | null;
  budget: number | null;
  financing_preference: string | null;
  status: string;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vehicle: {
    vin: string | null;
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
  } | null;
};

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
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

    const { id } = await params;

    let body: {
      status?: string;
      followUpDate?: string | null;
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

    const supabase = await createSupabaseServerClient();

    /*
     * Load the existing lead first so we can compare the previous
     * status/follow-up/notes and create accurate activity records.
     */
    const { data: existingLead, error: existingLeadError } = await supabase
      .from("leads")
      .select(
        `
        id,
        customer_id,
        customer_name,
        status,
        follow_up_date,
        notes
        `
      )
      .eq("id", id)
      .eq("dealership_id", profile.dealership_id)
      .maybeSingle();

    if (existingLeadError) {
      console.error("Lead lookup error:", existingLeadError);

      return NextResponse.json(
        {
          success: false,
          error: existingLeadError.message || "Failed to load lead.",
        },
        { status: 500 }
      );
    }

    if (!existingLead) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead not found.",
        },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    let statusChanged = false;
    let followUpChanged = false;
    let notesChanged = false;

    let previousStatus = existingLead.status;
    let newStatus = existingLead.status;

    if (body.status !== undefined) {
      const status = body.status.toUpperCase();

      if (!ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid status. Use one of: ${ALLOWED_STATUSES.join(
              ", "
            )}.`,
          },
          { status: 400 }
        );
      }

      newStatus = status;
      previousStatus = existingLead.status;

      if (previousStatus !== newStatus) {
        statusChanged = true;
      }

      updates.status = status;
    }

    if (body.followUpDate !== undefined) {
      const newFollowUpDate = body.followUpDate || null;

      if (existingLead.follow_up_date !== newFollowUpDate) {
        followUpChanged = true;
      }

      updates.follow_up_date = newFollowUpDate;
    }

    if (body.notes !== undefined) {
      const newNotes = body.notes.trim() || null;

      if ((existingLead.notes || null) !== newNotes) {
        notesChanged = true;
      }

      updates.notes = newNotes;
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Nothing to update.",
        },
        { status: 400 }
      );
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", id)
      .eq("dealership_id", profile.dealership_id)
      .select(
        `
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
        vehicle:vehicles(vin, year, make, model, trim)
        `
      )
      .maybeSingle();

    if (error) {
      console.error("Lead update error:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to update lead.",
        },
        { status: 500 }
      );
    }

    if (!lead) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead not found.",
        },
        { status: 404 }
      );
    }

    /*
     * Log CRM activity.
     *
     * We intentionally do not fail the lead update if activity logging
     * fails. The lead change is the primary operation.
     */

    if (statusChanged) {
      const { error: activityError } = await supabase
        .from("salesperson_activities")
        .insert({
          dealership_id: profile.dealership_id,
          customer_id: existingLead.customer_id,
          lead_id: existingLead.id,
          user_id: profile.id,
          activity_type: "STATUS_CHANGE",
          description: `Lead status changed from ${previousStatus} to ${newStatus}.`,
          activity_at: new Date().toISOString(),
          metadata: {
            previous_status: previousStatus,
            new_status: newStatus,
            source: "lead_update",
          },
        });

      if (activityError) {
        console.error("Lead status activity error:", activityError);
      }
    }

    if (followUpChanged) {
      const { error: activityError } = await supabase
        .from("salesperson_activities")
        .insert({
          dealership_id: profile.dealership_id,
          customer_id: existingLead.customer_id,
          lead_id: existingLead.id,
          user_id: profile.id,
          activity_type: "FOLLOW_UP",
          description: lead.follow_up_date
            ? `Follow-up scheduled for ${lead.follow_up_date}.`
            : "Follow-up date cleared.",
          activity_at: new Date().toISOString(),
          metadata: {
            previous_follow_up_date: existingLead.follow_up_date,
            new_follow_up_date: lead.follow_up_date,
            source: "lead_update",
          },
        });

      if (activityError) {
        console.error("Lead follow-up activity error:", activityError);
      }
    }

    if (notesChanged) {
      const { error: activityError } = await supabase
        .from("salesperson_activities")
        .insert({
          dealership_id: profile.dealership_id,
          customer_id: existingLead.customer_id,
          lead_id: existingLead.id,
          user_id: profile.id,
          activity_type: "NOTE",
          description: "Lead notes updated.",
          activity_at: new Date().toISOString(),
          metadata: {
            source: "lead_update",
          },
        });

      if (activityError) {
        console.error("Lead notes activity error:", activityError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        lead: lead as unknown as LeadRecord,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Lead PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
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

    const { id } = await params;

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", id)
      .eq("dealership_id", profile.dealership_id);

    if (error) {
      console.error("Lead delete error:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to delete lead.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Lead DELETE error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}


