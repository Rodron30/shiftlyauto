import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { syncIntegration } from "@/lib/integrations/sync";
import type { Integration } from "@/lib/integrations/types";

interface IntegrationScheduleConfig {
  schedule_interval?: string;
  schedule_hour?: number;
  schedule_day?: number;
}

/**
 * Vercel Cron Job: Scheduled Integration Sync
 * Path: /api/cron/integrations
 * Schedule: Configured in vercel.json
 *
 * This endpoint is called by Vercel's cron system to execute
 * scheduled integration syncs for dealerships with automatic scheduling enabled.
 */
export async function GET(request: Request) {
  // Verify this is a cron job (basic security)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured.");
    return NextResponse.json({ error: "Cron secret is not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();

    // Get all scheduled integrations that are due for sync
    const now = new Date().toISOString();

    const { data: scheduledIntegrations, error: fetchError } = await supabase
      .from("integrations")
      .select("*")
      .eq("schedule_enabled", true)
      .lte("next_scheduled_at", now)
      .in("status", ["CONNECTED", "ERROR"]) // Skip DISABLED or SYNCING
      .order("next_scheduled_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching scheduled integrations:", fetchError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!scheduledIntegrations || scheduledIntegrations.length === 0) {
      return NextResponse.json({
        message: "No integrations due for sync",
        processed: 0,
      });
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const integration of scheduledIntegrations) {
      let didClaim = false;
      let syncLogId: string | null = null;

      try {
        // Atomically claim the integration before creating its sync log.
        const { data: claimed, error: claimError } = await supabase
          .from("integrations")
          .update({
            status: "SYNCING",
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", integration.id)
          .eq("dealership_id", integration.dealership_id)
          .in("status", ["CONNECTED", "ERROR"])
          .select("id")
          .maybeSingle();

        if (claimError) {
          console.error(
            `Failed to claim integration ${integration.id}:`,
            claimError
          );
          failed++;
          continue;
        }

        if (!claimed) {
          // Another request claimed it, or its status changed.
          continue;
        }

        didClaim = true;

        const { data: log, error: logError } = await supabase
          .from("integration_sync_logs")
          .insert({
            integration_id: integration.id,
            dealership_id: integration.dealership_id,
            sync_type: "SCHEDULED",
            status: "STARTED",
            started_at: new Date().toISOString(),
          })
          .select("*")
          .single();

        if (logError || !log) {
          console.error(
            `Failed to create sync log for integration ${integration.id}:`,
            logError
          );

          const { error: releaseError } = await supabase
            .from("integrations")
            .update({
              status: integration.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", integration.id)
            .eq("dealership_id", integration.dealership_id)
            .eq("status", "SYNCING");

          if (releaseError) {
            console.error(
              `Failed to release integration ${integration.id}:`,
              releaseError
            );
          }

          failed++;
          continue;
        }

        syncLogId = log.id;

        // Execute sync
        const result = await syncIntegration(integration as Integration);

        // Persist the sync result before finalizing the integration.
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
          .eq("dealership_id", integration.dealership_id);

        if (syncLogUpdateError) {
          throw new Error(
            `Unable to save sync log: ${syncLogUpdateError.message}`
          );
        }

        const nextScheduledAt = calculateNextScheduledAt(integration);

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
            .eq("dealership_id", integration.dealership_id)
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
        if (result.status === "SUCCESS" || result.status === "PARTIAL") {
          succeeded++;
        } else {
          failed++;
        }

        processed++;
      } catch (error) {
        console.error("Error processing integration " + integration.id + ":", error);
        failed++;

        const completedAt = new Date().toISOString();
        const errorMessage = error instanceof Error ? error.message : "Sync failed";

        if (syncLogId) {
          const { error: syncLogError } = await supabase
            .from("integration_sync_logs")
            .update({
              status: "FAILED",
              records_failed: 1,
              error_message: errorMessage,
              completed_at: completedAt,
            })
            .eq("id", syncLogId)
            .eq("dealership_id", integration.dealership_id);

          if (syncLogError) {
            console.error("Failed to update scheduled sync log:", syncLogError);
          }
        }

        if (didClaim) {
          const { error: statusError } = await supabase
            .from("integrations")
            .update({
              status: "ERROR",
              last_error: errorMessage,
              updated_at: completedAt,
            })
            .eq("id", integration.id)
            .eq("dealership_id", integration.dealership_id)
            .eq("status", "SYNCING");

          if (statusError) {
            console.error("Failed to update integration status:", statusError);
          }
        }
      }
    }

    return NextResponse.json({
      message: "Scheduled sync completed",
      processed,
      succeeded,
      failed,
    });
  } catch (error) {
    console.error("Scheduled sync job error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Calculates the next scheduled execution time based on integration configuration.
 */

function calculateNextScheduledAt(
  integration: IntegrationScheduleConfig
): string {
  const now = new Date();
  const interval = integration.schedule_interval || "DAILY";
  const hour = integration.schedule_hour ?? 0;
  const day = integration.schedule_day ?? 1;

  const nextScheduled = new Date(now);

  switch (interval) {
    case "HOURLY":
      nextScheduled.setMinutes(0, 0, 0);
      nextScheduled.setHours(nextScheduled.getHours() + 1);
      break;

    case "DAILY":
      nextScheduled.setHours(hour, 0, 0, 0);
      if (nextScheduled <= now) {
        nextScheduled.setDate(nextScheduled.getDate() + 1);
      }
      break;

    case "WEEKLY": {
      nextScheduled.setHours(hour, 0, 0, 0);
      const currentDay = nextScheduled.getDay();
      const targetDay = day === 7 ? 0 : day;
      const daysUntilTarget = (targetDay - currentDay + 7) % 7;

      nextScheduled.setDate(nextScheduled.getDate() + daysUntilTarget);

      if (nextScheduled <= now) {
        nextScheduled.setDate(nextScheduled.getDate() + 7);
      }
      break;
    }

    case "MONTHLY":
      nextScheduled.setHours(hour, 0, 0, 0);
      nextScheduled.setDate(1);
      if (nextScheduled <= now) {
        nextScheduled.setMonth(nextScheduled.getMonth() + 1);
      }
      break;

    default:
      nextScheduled.setHours(hour, 0, 0, 0);
      if (nextScheduled <= now) {
        nextScheduled.setDate(nextScheduled.getDate() + 1);
      }
  }

  return nextScheduled.toISOString();
}

