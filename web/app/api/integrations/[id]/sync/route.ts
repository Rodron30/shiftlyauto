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
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (
      profile.role !== "admin" &&
      profile.role !== "manager"
    ) {
      return NextResponse.json(
        { error: "Only managers and admins can sync integrations" },
        { status: 403 }
      );
    }

    const saasAccess = await requireSaasAccess();

    if (!saasAccess.ok) {
      return NextResponse.json(
        {
          error: saasAccess.error,
        },
        { status: saasAccess.status }
      );
    }

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
      return NextResponse.json(
        { error: "Unable to load integration" },
        { status: 500 }
      );
    }

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    if (integration.status === "DISABLED") {
      return NextResponse.json(
        { error: "Integration is disabled" },
        { status: 400 }
      );
    }

    const startedAt = new Date().toISOString();

    const { data: claimed, error: claimError } = await supabase
      .from("integrations")
      .update({
        status: "SYNCING",
        last_error: null,
        updated_at: startedAt,
      })
      .eq("id", integration.id)
      .eq("dealership_id", profile.dealership_id)
      .in("status", ["CONNECTED", "ERROR"])
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error("Manual sync claim failed:", claimError);
      return NextResponse.json(
        { error: "Unable to claim integration for sync" },
        { status: 500 }
      );
    }

    if (!claimed) {
      return NextResponse.json(
        { error: "Integration is already syncing or is no longer eligible." },
        { status: 409 }
      );
    }

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

      const { error: releaseError } = await supabase
        .from("integrations")
        .update({
          status: integration.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id)
        .eq("dealership_id", profile.dealership_id)
        .eq("status", "SYNCING");

      if (releaseError) {
        console.error("Manual sync claim release failed:", releaseError);
      }

      return NextResponse.json(
        { error: "Unable to create sync log" },
        { status: 500 }
      );
    }
    try {
      const result = await syncIntegration(
        integration as Integration
      );

      const completedAt = new Date().toISOString();

      const { error: syncLogUpdateError } = await supabase
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

      if (syncLogUpdateError) {
        throw new Error(
          `Unable to save sync log: ${syncLogUpdateError.message}`
        );
      }

      let nextScheduledAt: string | null = null;

      if (integration.schedule_enabled) {
        nextScheduledAt = calculateNextScheduledAt(integration);
      }

      const { data: finalized, error: integrationUpdateError } =
        await supabase
          .from("integrations")
          .update({
            status: result.status === "SUCCESS" ? "CONNECTED" : "ERROR",
            last_sync_at: completedAt,
            last_error: result.errorMessage ?? null,
            next_scheduled_at: nextScheduledAt,
            updated_at: completedAt,
          })
          .eq("id", integration.id)
          .eq("dealership_id", profile.dealership_id)
          .eq("status", "SYNCING")
          .select("id")
          .maybeSingle();

      if (integrationUpdateError) {
        throw new Error(
          `Unable to finalize integration: ${integrationUpdateError.message}`
        );
      }

      if (!finalized) {
        throw new Error(
          "Integration status changed before sync finalization."
        );
      }

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

      const { error: syncLogFailureError } = await supabase
        .from("integration_sync_logs")
        .update({
          status: "FAILED",
          records_failed: 1,
          error_message: errorMessage,
          completed_at: completedAt,
        })
        .eq("id", log.id)
        .eq("dealership_id", profile.dealership_id);

      if (syncLogFailureError) {
        console.error(
          "Manual sync failure log update failed:",
          syncLogFailureError
        );
      }

      const { data: failedIntegration, error: integrationFailureError } =
        await supabase
          .from("integrations")
          .update({
            status: "ERROR",
            last_sync_at: completedAt,
            last_error: errorMessage,
            updated_at: completedAt,
          })
          .eq("id", integration.id)
          .eq("dealership_id", profile.dealership_id)
          .eq("status", "SYNCING")
          .select("id")
          .maybeSingle();

      if (integrationFailureError) {
        console.error(
          "Manual sync integration failure update failed:",
          integrationFailureError
        );
      } else if (!failedIntegration) {
        console.warn(
          `Integration ${integration.id} was not changed to ERROR because it is no longer SYNCING.`
        );
      }

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

/**
 * Calculates the next scheduled execution time based on integration configuration.
 */
type IntegrationScheduleConfig = {
  schedule_interval?: string | null;
  schedule_hour?: number | null;
  schedule_day?: number | null;
};

function calculateNextScheduledAt(
  integration: IntegrationScheduleConfig
): string {
  const now = new Date();
  const interval = integration.schedule_interval || "DAILY";
  const hour = integration.schedule_hour || 0;
  const day = integration.schedule_day || 1; // Monday

  const nextScheduled = new Date(now);

  switch (interval) {
    case "HOURLY":
      nextScheduled.setHours(nextScheduled.getHours() + 1);
      break;

    case "DAILY":
      nextScheduled.setHours(hour, 0, 0, 0);
      if (nextScheduled <= now) {
        nextScheduled.setDate(nextScheduled.getDate() + 1);
      }
      break;

    case "WEEKLY":
      nextScheduled.setHours(hour, 0, 0, 0);
      const currentDay = nextScheduled.getDay(); // 0=Sunday, 1=Monday
      const targetDay = day === 7 ? 0 : day; // Convert 7 (Sunday) to 0
      const daysUntilTarget = (targetDay - currentDay + 7) % 7;
      nextScheduled.setDate(nextScheduled.getDate() + (daysUntilTarget || 7));
      if (nextScheduled <= now) {
        nextScheduled.setDate(nextScheduled.getDate() + 7);
      }
      break;

    case "MONTHLY":
      nextScheduled.setHours(hour, 0, 0, 0);
      nextScheduled.setDate(1); // First of the month
      if (nextScheduled <= now) {
        nextScheduled.setMonth(nextScheduled.getMonth() + 1);
      }
      break;

    default:
      // Default to daily
      nextScheduled.setHours(hour, 0, 0, 0);
      if (nextScheduled <= now) {
        nextScheduled.setDate(nextScheduled.getDate() + 1);
      }
  }

  return nextScheduled.toISOString();
}


