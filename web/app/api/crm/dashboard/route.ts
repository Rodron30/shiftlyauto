import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

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

    const dealershipId = profile.dealership_id;
    const supabase = await createSupabaseServerClient();

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const todayStartIso = todayStart.toISOString();
    const tomorrowStartIso = tomorrowStart.toISOString();

    const { data: dealershipVehicles, error: dealershipVehiclesError } =
      await supabase
        .from("vehicles")
        .select("id")
        .eq("dealership_id", dealershipId);

    if (dealershipVehiclesError) {
      console.error(
        "CRM dashboard vehicle lookup error:",
        dealershipVehiclesError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load dealership vehicles.",
        },
        { status: 500 }
      );
    }

    const vehicleIds = (dealershipVehicles ?? []).map(
      (vehicle) => vehicle.id
    );

    const [
      customersResult,
      leadsResult,
      dueLeadsResult,
      reportsResult,
      activitiesTodayResult,
      recentLeadsResult,
      recentActivitiesResult,
      recentReportsResult,
    ] = await Promise.all([
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("dealership_id", dealershipId),

      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("dealership_id", dealershipId)
        .not("status", "in", "(WON,LOST)"),

      supabase
        .from("leads")
        .select(
          `
          id,
          customer_id,
          customer_name,
          status,
          follow_up_date,
          vehicle_id,
          customer:customers(
            id,
            name,
            phone,
            email
          ),
          vehicle:vehicles(
            id,
            vin,
            year,
            make,
            model,
            trim
          )
        `
        )
        .eq("dealership_id", dealershipId)
        .not("status", "in", "(WON,LOST)")
        .not("follow_up_date", "is", null)
        .lte("follow_up_date", todayStartIso)
        .order("follow_up_date", { ascending: true })
        .limit(10),

      vehicleIds.length > 0
        ? supabase
            .from("reports")
            .select("id", { count: "exact", head: true })
            .in("vehicle_id", vehicleIds)
        : Promise.resolve({
            data: null,
            count: 0,
            error: null,
          }),

      supabase
        .from("salesperson_activities")
        .select("id", { count: "exact", head: true })
        .eq("dealership_id", dealershipId)
        .gte("activity_at", todayStartIso)
        .lt("activity_at", tomorrowStartIso),

      supabase
        .from("leads")
        .select(
          `
          id,
          customer_id,
          customer_name,
          status,
          follow_up_date,
          vehicle_id,
          created_at,
          customer:customers(
            id,
            name,
            phone,
            email
          ),
          vehicle:vehicles(
            id,
            vin,
            year,
            make,
            model,
            trim
          )
        `
        )
        .eq("dealership_id", dealershipId)
        .order("created_at", { ascending: false })
        .limit(5),

      supabase
        .from("salesperson_activities")
        .select(
          `
          id,
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
            name
          ),
          lead:leads(
            id,
            customer_name,
            status
          ),
          user:users(
            id,
            name,
            email
          )
        `
        )
        .eq("dealership_id", dealershipId)
        .order("activity_at", { ascending: false })
        .limit(8),

      vehicleIds.length > 0
        ? supabase
            .from("reports")
            .select(
              `
              id,
              vehicle_id,
              customer_id,
              lead_id,
              created_by,
              share_token,
              created_at,
              customer_report,
              customer:customers(
                id,
                name,
                phone,
                email
              ),
              lead:leads(
                id,
                customer_id,
                customer_name,
                status,
                follow_up_date,
                vehicle_id
              ),
              salesperson:users(
                id,
                name,
                email
              )
            `
            )
            .in("vehicle_id", vehicleIds)
            .order("created_at", { ascending: false })
            .limit(5)
        : Promise.resolve({
            data: [],
            error: null,
          }),
    ]);

    if (customersResult.error) {
      console.error("CRM dashboard customers error:", customersResult.error);
    }

    if (leadsResult.error) {
      console.error("CRM dashboard leads error:", leadsResult.error);
    }

    if (dueLeadsResult.error) {
      console.error("CRM dashboard due leads error:", dueLeadsResult.error);
    }

    if (reportsResult.error) {
      console.error("CRM dashboard reports error:", reportsResult.error);
    }

    if (activitiesTodayResult.error) {
      console.error(
        "CRM dashboard activities error:",
        activitiesTodayResult.error
      );
    }

    if (recentLeadsResult.error) {
      console.error(
        "CRM dashboard recent leads error:",
        recentLeadsResult.error
      );
    }

    if (recentActivitiesResult.error) {
      console.error(
        "CRM dashboard recent activities error:",
        recentActivitiesResult.error
      );
    }

    if (recentReportsResult.error) {
      console.error(
        "CRM dashboard recent reports error:",
        recentReportsResult.error
      );
    }

    const followUps = dueLeadsResult.data ?? [];

    const overdueFollowUps = followUps.filter((lead) => {
      if (!lead.follow_up_date) {
        return false;
      }

      return new Date(lead.follow_up_date) < todayStart;
    });

    const todayFollowUps = followUps.filter((lead) => {
      if (!lead.follow_up_date) {
        return false;
      }

      const date = new Date(lead.follow_up_date);

      return (
        date >= todayStart &&
        date < tomorrowStart
      );
    });

    return NextResponse.json(
      {
        success: true,
        stats: {
          totalCustomers: customersResult.count ?? 0,
          activeLeads: leadsResult.count ?? 0,
          followUpsDue: followUps.length,
          overdueFollowUps: overdueFollowUps.length,
          todayFollowUps: todayFollowUps.length,
          reportsGenerated: reportsResult.count ?? 0,
          activitiesToday: activitiesTodayResult.count ?? 0,
        },
        followUps,
        recentLeads: recentLeadsResult.data ?? [],
        recentActivities: recentActivitiesResult.data ?? [],
        recentReports: recentReportsResult.data ?? [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("CRM dashboard API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}
