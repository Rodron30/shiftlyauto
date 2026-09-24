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
      .neq("status", "DISABLED");

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
        if (integration.status === "SYNCING") {
          results.push({
            integration_id: integration.id,
            dealership_id: integration.dealership_id,
            name: integration.name,
            status: "SKIPPED",
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            errorMessage: "Integration is already syncing.",
          });

          continue;
        }

        const { data: log, error: logError } =
          await supabase
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
          throw new Error("Unable to create scheduled sync log.");
        }

        await supabase
          .from("integrations")
          .update({
            status: "SYNCING",
            last_error: null,
            updated_at: startedAt,
          })
          .eq("id", integration.id)
          .eq("dealership_id", integration.dealership_id);

        try {
          const result = await syncIntegration(
            integration as Integration
          );

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
            .eq("dealership_id", integration.dealership_id);

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
            .eq("dealership_id", integration.dealership_id);

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

          await supabase
            .from("integration_sync_logs")
            .update({
              status: "FAILED",
              records_failed: 1,
              error_message: errorMessage,
              completed_at: completedAt,
            })
            .eq("id", log.id)
            .eq("dealership_id", integration.dealership_id);

          await supabase
            .from("integrations")
            .update({
              status: "ERROR",
              last_sync_at: completedAt,
              last_error: errorMessage,
              updated_at: completedAt,
            })
            .eq("id", integration.id)
            .eq("dealership_id", integration.dealership_id);

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
