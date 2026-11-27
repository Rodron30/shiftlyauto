import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { syncIntegration } from "@/lib/integrations/sync";
import type { Integration } from "@/lib/integrations/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET is not configured.");

      return NextResponse.json(
        { error: "Cron secret is not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const {
      data: integrations,
      error: integrationError,
    } = await supabase
      .from("integrations")
      .select("*")
      .eq("integration_type", "INVENTORY")
      .in("status", ["CONNECTED", "ERROR"]);

    if (integrationError) {
      console.error(
        "Cron inventory sync integration lookup:",
        integrationError
      );

      return NextResponse.json(
        { error: "Unable to load integrations" },
        { status: 500 }
      );
    }

    const results: Array<{
      integration_id: string;
      dealership_id: string;
      name: string;
      status: string;
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsFailed: number;
      errorMessage?: string;
    }> = [];

    for (const integration of integrations ?? []) {
      const startedAt = new Date().toISOString();

      try {
        const { data: claimed, error: claimError } = await supabase
          .from("integrations")
          .update({
            status: "SYNCING",
            last_error: null,
            updated_at: startedAt,
          })
          .eq("id", integration.id)
          .eq("dealership_id", integration.dealership_id)
          .in("status", ["CONNECTED", "ERROR"])
          .select("id")
          .maybeSingle();

        if (claimError) {
          throw new Error(
            `Unable to claim integration ${integration.id}: ${claimError.message}`
          );
        }

        if (!claimed) {
          results.push({
            integration_id: integration.id,
            dealership_id: integration.dealership_id,
            name: integration.name,
            status: "SKIPPED",
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            errorMessage: "Integration was claimed by another request or is no longer eligible.",
          });

          continue;
        }

        const { data: log, error: logError } = await supabase
          .from("integration_sync_logs")
          .insert({
            integration_id: integration.id,
            dealership_id: integration.dealership_id,
            sync_type: "SCHEDULED",
            status: "STARTED",
            started_at: startedAt,
          })
          .select("*")
          .single();

        if (logError || !log) {
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

          throw new Error("Unable to create scheduled sync log.");
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
            .eq("dealership_id", integration.dealership_id);

          if (syncLogUpdateError) {
            throw new Error(
              `Unable to save inventory sync log: ${syncLogUpdateError.message}`
            );
          }

          const { data: finalized, error: integrationUpdateError } =
            await supabase
              .from("integrations")
              .update({
                status: result.status === "SUCCESS" ? "CONNECTED" : "ERROR",
                last_sync_at: completedAt,
                last_error: result.errorMessage ?? null,
                updated_at: completedAt,
              })
              .eq("id", integration.id)
              .eq("dealership_id", integration.dealership_id)
              .eq("status", "SYNCING")
              .select("id")
              .maybeSingle();

          if (integrationUpdateError) {
            throw new Error(
              `Unable to finalize inventory integration: ${integrationUpdateError.message}`
            );
          }

          if (!finalized) {
            throw new Error(
              "Integration status changed before inventory sync finalization."
            );
          }

          results.push({
            integration_id: integration.id,
            dealership_id: integration.dealership_id,
            name: integration.name,
            status: result.status,
            recordsProcessed: result.recordsProcessed,
            recordsCreated: result.recordsCreated,
            recordsUpdated: result.recordsUpdated,
            recordsFailed: result.recordsFailed,
            errorMessage: result.errorMessage,
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
            .eq("dealership_id", integration.dealership_id);

          if (syncLogFailureError) {
            console.error(
              `Failed to mark sync log ${log.id} as FAILED:`,
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
              .eq("dealership_id", integration.dealership_id)
              .eq("status", "SYNCING")
              .select("id")
              .maybeSingle();

          if (integrationFailureError) {
            console.error(
              `Failed to mark integration ${integration.id} as ERROR:`,
              integrationFailureError
            );
          } else if (!failedIntegration) {
            console.warn(
              `Integration ${integration.id} was not changed to ERROR because it is no longer SYNCING.`
            );
          }

          results.push({
            integration_id: integration.id,
            dealership_id: integration.dealership_id,
            name: integration.name,
            status: "FAILED",
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsFailed: 1,
            errorMessage,
          });
        }
      } catch (error) {
        console.error(
          `Cron inventory sync failed for ${integration.id}:`,
          error
        );

        results.push({
          integration_id: integration.id,
          dealership_id: integration.dealership_id,
          name: integration.name,
          status: "FAILED",
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsFailed: 1,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown sync error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      sync_type: "SCHEDULED",
      integrations_processed: results.length,
      results,
    });
  } catch (error) {
    console.error(
      "Cron inventory sync error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Cron inventory sync failed",
      },
      { status: 500 }
    );
  }
}
