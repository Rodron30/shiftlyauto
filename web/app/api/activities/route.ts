import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

const ACTIVITY_TYPES = [
  "CALL",
  "SMS",
  "EMAIL",
  "MEETING",
  "NOTE",
  "FOLLOW_UP",
  "STATUS_CHANGE",
] as const;

export async function GET(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.dealership_id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const customerId = searchParams.get("customerId")?.trim() || "";
    const leadId = searchParams.get("leadId")?.trim() || "";
    const userId = searchParams.get("userId")?.trim() || "";
    const limitParam = Number(searchParams.get("limit") || "100");

    const limit = Math.min(
      Math.max(Number.isFinite(limitParam) ? limitParam : 100, 1),
      200
    );

    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("salesperson_activities")
      .select(`
        id,
        dealership_id,
        customer_id,
        lead_id,
        user_id,
        activity_type,
        description,
        activity_at,
        metadata,
        created_at,
        customer:customers(
          id,
          name,
          phone,
          email
        ),
        lead:leads(
          id,
          customer_name,
          status
        ),
        user:users(
          id,
          name,
          email,
          role
        )
      `)
      .eq("dealership_id", profile.dealership_id)
      .order("activity_at", { ascending: false })
      .limit(limit);

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    if (leadId) {
      query = query.eq("lead_id", leadId);
    }

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("GET /api/activities error:", error);

      return NextResponse.json(
        { error: "Unable to load activities" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      activities: data ?? [],
    });
  } catch (error) {
    console.error("GET /api/activities exception:", error);

    return NextResponse.json(
      { error: "Unable to load activities" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const customerId = String(body.customerId ?? "").trim() || null;
    const leadId = String(body.leadId ?? "").trim() || null;

    const activityType = String(
      body.activityType ?? ""
    ).trim().toUpperCase();

    const description =
      String(body.description ?? "").trim() || null;

    const activityAt =
      String(body.activityAt ?? "").trim() || null;

    const metadata =
      body.metadata &&
      typeof body.metadata === "object" &&
      !Array.isArray(body.metadata)
        ? body.metadata
        : {};

    if (
      !ACTIVITY_TYPES.includes(
        activityType as (typeof ACTIVITY_TYPES)[number]
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid activity type. Allowed values: CALL, SMS, EMAIL, MEETING, NOTE, FOLLOW_UP, STATUS_CHANGE",
        },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: "Activity description is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    if (customerId) {
      const { data: customer, error: customerError } =
        await supabase
          .from("customers")
          .select("id")
          .eq("id", customerId)
          .eq("dealership_id", profile.dealership_id)
          .maybeSingle();

      if (customerError) {
        console.error(
          "POST /api/activities customer lookup error:",
          customerError
        );

        return NextResponse.json(
          { error: "Unable to validate customer" },
          { status: 500 }
        );
      }

      if (!customer) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }
    }

    if (leadId) {
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("id, customer_id")
        .eq("id", leadId)
        .eq("dealership_id", profile.dealership_id)
        .maybeSingle();

      if (leadError) {
        console.error(
          "POST /api/activities lead lookup error:",
          leadError
        );

        return NextResponse.json(
          { error: "Unable to validate lead" },
          { status: 500 }
        );
      }

      if (!lead) {
        return NextResponse.json(
          { error: "Lead not found" },
          { status: 404 }
        );
      }

      if (
        customerId &&
        lead.customer_id &&
        lead.customer_id !== customerId
      ) {
        return NextResponse.json(
          {
            error:
              "Lead and customer do not belong to the same customer record",
          },
          { status: 400 }
        );
      }
    }

    const insertData = {
      dealership_id: profile.dealership_id,
      customer_id: customerId,
      lead_id: leadId,
      user_id: profile.id,
      activity_type: activityType,
      description,
      activity_at: activityAt || undefined,
      metadata,
    };

    const { data, error } = await supabase
      .from("salesperson_activities")
      .insert(insertData)
      .select(`
        id,
        customer_id,
        lead_id,
        user_id,
        activity_type,
        description,
        activity_at,
        metadata,
        created_at
      `)
      .single();

    if (error) {
      console.error("POST /api/activities error:", error);

      return NextResponse.json(
        { error: "Unable to create activity" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { activity: data },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/activities exception:", error);

    return NextResponse.json(
      { error: "Unable to create activity" },
      { status: 500 }
    );
  }
}
