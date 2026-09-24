import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";
import { syncIntegration } from "@/lib/integrations/sync";
import { requireSaasAccess } from "@/lib/saas";
import type {
  Integration,
  SyncType,
} from "@/lib/integrations/types";

const SYNC_TYPES: SyncType[] = [
  "IMPORT",
  "EXPORT",
  "TWO_WAY",
  "MANUAL",
  "SCHEDULED",
];

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  console.log("🚀 ACTUAL SYNC ROUTE REACHED - Route handler entry");
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      console.log("🏁 ACTUAL SYNC ROUTE RETURNING - Unauthorized");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (
      profile.role !== "admin" &&
      profile.role !== "manager"
    ) {
      console.log("🏁 ACTUAL SYNC ROUTE RETURNING - Forbidden");
      return NextResponse.json(
        { error: "Only managers and admins can sync integrations" },
        { status: 403 }
      );
    }

    const saasAccess = await requireSaasAccess();

    if (!saasAccess.ok) {
      console.log("🏁 ACTUAL SYNC ROUTE RETURNING - SaaS Access Failed");
      return NextResponse.json(
        {
          error: saasAccess.error,
        },
        { status: saasAccess.status }
      );
    }

    console.log("🚀 ACTUAL SYNC ROUTE REACHED - After requireSaasAccess");

    const { id } = await context.params;

    let body: Record<string, unknown> = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const requestedSyncType =
      typeof body.sync_type === "string"
        ? body.sync_type
        : "MANUAL";

    if (
      !SYNC_TYPES.includes(
        requestedSyncType as SyncType
      )
    ) {
      console.log("🏁 ACTUAL SYNC ROUTE RETURNING - Invalid sync type");
      return NextResponse.json(
        { error: "Invalid sync type" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data: integration, error: integrationError } =
      await supabase
        .from("integrations")
        .select("*")
        .eq("id", id)
        .eq("dealership_id", profile.dealership_id)
        .maybeSingle();

    if (integrationError) {
      console.error(
        "POST /api/integrations/[id]/sync lookup:",
        integrationError
      );
      console.log("🏁 ACTUAL SYNC ROUTE RETURNING - Integration lookup error");

      return NextResponse.json(
        { error: "Unable to load integration" },
        { status: 500 }
      );
    }

    if (!integration) {
      console.log("🏁 ACTUAL SYNC ROUTE RETURNING - Integration not found");
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    if (integration.status === "DISABLED") {
      console.log("🏁 ACTUAL SYNC ROUTE RETURNING - Integration disabled");
      return NextResponse.json(
        { error: "Integration is disabled" },
        { status: 400 }
      );
    }

    const startedAt = new Date().toISOString();

    const { data: log, error: logError } = await supabase
      .from("integration_sync_logs")
      .insert({
        integration_id: integration.id,
        dealership_id: profile.dealership_id,
        sync_type: requestedSyncType,
        status: "STARTED",
        started_at: startedAt,
      })
      .select("*")
      .single();

    if (logError || !log) {
      console.error(
        "POST /api/integrations/[id]/sync log:",
        logError
      );
      console.log("🏁 ACTUAL SYNC ROUTE RETURNING - Sync log creation error");

      return NextResponse.json(
        { error: "Unable to create sync log" },
        { status: 500 }
      );
    }

    await supabase
      .from("integrations")
      .update({
        status: "SYNCING",
        last_error: null,
        updated_at: startedAt,
      })
      .eq("id", integration.id)
      .eq("dealership_id", profile.dealership_id);

    console.log("🚀 ACTUAL SYNC ROUTE REACHED - About to call syncIntegration");

    try {
      console.log(`🚀 SYNC START: Integration ID ${integration.id}, Type ${integration.integration_type}`);
      console.log(`📋 Integration Config:`, {
        id: integration.id,
        type: integration.integration_type,
        status: integration.status,
        dealership_id: integration.dealership_id,
        config: integration.config
      });

      const result = await syncIntegration(
        integration as Integration
      );

      console.log(`✅ SYNC COMPLETE: Integration ID ${integration.id}`, {
        status: result.status,
        recordsProcessed: result.recordsProcessed,
        recordsCreated: result.recordsCreated,
        recordsUpdated: result.recordsUpdated,
        recordsFailed: result.recordsFailed,
        errorMessage: result.errorMessage
      });

      const completedAt = new Date().toISOString();

      await supabase
        .from("integration_sync_logs")
        .update({
          status: result.status,
          records_processed: result.recordsProcessed,
          records_created: result.recordsCreated,
          records_updated: result.recordsUpdated,
          records_failed: result.recordsFailed,
          error_message: result.errorMessage ?? null,
          completed_at: completedAt,
        })
        .eq("id", log.id)
        .eq("dealership_id", profile.dealership_id);

      await supabase
        .from("integrations")
        .update({
          status:
            result.status === "FAILED"
              ? "ERROR"
              : "CONNECTED",
          last_sync_at: completedAt,
          last_error: result.errorMessage ?? null,
          updated_at: completedAt,
        })
        .eq("id", integration.id)
        .eq("dealership_id", profile.dealership_id);

      console.log("🏁 ACTUAL SYNC ROUTE RETURNING - Success");
      return NextResponse.json({
        integration_id: integration.id,
        sync_log_id: log.id,
        result,
      });
    } catch (syncError) {
      const completedAt = new Date().toISOString();

      const errorMessage =
        syncError instanceof Error
          ? syncError.message
          : "Integration sync failed";

      await supabase
        .from("integration_sync_logs")
        .update({
          status: "FAILED",
          records_failed: 1,
          error_message: errorMessage,
          completed_at: completedAt,
        })
        .eq("id", log.id)
        .eq("dealership_id", profile.dealership_id);

      await supabase
        .from("integrations")
        .update({
          status: "ERROR",
          last_sync_at: completedAt,
          last_error: errorMessage,
          updated_at: completedAt,
        })
        .eq("id", integration.id)
        .eq("dealership_id", profile.dealership_id);

      console.log("🏁 ACTUAL SYNC ROUTE RETURNING - Error");
      return NextResponse.json(
        {
          error: "Integration sync failed",
          sync_log_id: log.id,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(
      "POST /api/integrations/[id]/sync exception:",
      error
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

