import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";
import {
  requireSaasAccess,
  getSaasLimit,
  getSaasLimitError,
} from "@/lib/saas";
import type {
  IntegrationType,
  IntegrationStatus,
  SyncDirection,
} from "@/lib/integrations/types";

const INTEGRATION_TYPES: IntegrationType[] = [
  "DMS",
  "CRM",
  "INVENTORY",
  "DEALER_WEBSITE",
  "ACCOUNTING",
];

const INTEGRATION_STATUSES: IntegrationStatus[] = [
  "DISCONNECTED",
  "CONNECTED",
  "SYNCING",
  "ERROR",
  "DISABLED",
];

const SYNC_DIRECTIONS: SyncDirection[] = [
  "IMPORT",
  "EXPORT",
  "TWO_WAY",
];

function isManagerOrAdmin(role: unknown): boolean {
  return role === "admin" || role === "manager";
}

const SAFE_FIELD_LIST = [
  "id",
  "dealership_id",
  "integration_type",
  "provider",
  "name",
  "status",
  "sync_direction",
  "last_sync_at",
  "last_error",
  "created_by",
  "created_at",
  "updated_at",
];

const SAFE_FIELDS = SAFE_FIELD_LIST.join(",");

export async function GET(
  _request: Request,
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

    const { id } = await context.params;

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("integrations")
      .select(SAFE_FIELDS)
      .eq("id", id)
      .eq("dealership_id", profile.dealership_id)
      .maybeSingle();

    if (error) {
      console.error("GET /api/integrations/[id]:", error);

      return NextResponse.json(
        { error: "Unable to load integration" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ integration: data });
  } catch (error) {
    console.error("GET /api/integrations/[id] exception:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    if (!isManagerOrAdmin(profile.role)) {
      return NextResponse.json(
        { error: "Only managers and admins can manage integrations" },
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
    const body = await request.json();

    const supabase = await createSupabaseServerClient();

    const { data: existing, error: existingError } = await supabase
      .from("integrations")
      .select("*")
      .eq("id", id)
      .eq("dealership_id", profile.dealership_id)
      .maybeSingle();

    if (existingError) {
      console.error("PATCH integration lookup:", existingError);

      return NextResponse.json(
        { error: "Unable to load integration" },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (body?.integration_type !== undefined) {
      if (
        typeof body.integration_type !== "string" ||
        !INTEGRATION_TYPES.includes(
          body.integration_type as IntegrationType
        )
      ) {
        return NextResponse.json(
          { error: "Invalid integration type" },
          { status: 400 }
        );
      }

      updates.integration_type = body.integration_type;
    }

    if (body?.provider !== undefined) {
      if (
        typeof body.provider !== "string" ||
        !body.provider.trim()
      ) {
        return NextResponse.json(
          { error: "Provider is required" },
          { status: 400 }
        );
      }

      updates.provider = body.provider.trim();
    }

    if (body?.name !== undefined) {
      if (
        typeof body.name !== "string" ||
        !body.name.trim()
      ) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      updates.name = body.name.trim();
    }

    if (body?.status !== undefined) {
      if (
        typeof body.status !== "string" ||
        !INTEGRATION_STATUSES.includes(
          body.status as IntegrationStatus
        )
      ) {
        return NextResponse.json(
          { error: "Invalid integration status" },
          { status: 400 }
        );
      }

      updates.status = body.status;
    }

    if (
      existing.status === "DISABLED" &&
      body?.status !== undefined &&
      body.status !== "DISABLED"
    ) {
      const integrationLimit = getSaasLimit(
        saasAccess.context.plan,
        "integrations"
      );

      if (integrationLimit !== null) {
        const { count: configuredIntegrationCount, error: integrationCountError } =
          await supabase
            .from("integrations")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "dealership_id",
              profile.dealership_id
            )
            .neq("status", "DISABLED");

        if (integrationCountError) {
          console.error(
            "SaaS integration count error:",
            integrationCountError
          );

          return NextResponse.json(
            {
              error: "Failed to check integration plan limit.",
            },
            { status: 500 }
          );
        }

        if (
          (configuredIntegrationCount ?? 0) >=
          integrationLimit
        ) {
          return NextResponse.json(
            {
              error: getSaasLimitError(
                "Integration",
                integrationLimit
              ),
            },
            { status: 403 }
          );
        }
      }
    }

    if (body?.sync_direction !== undefined) {
      if (
        typeof body.sync_direction !== "string" ||
        !SYNC_DIRECTIONS.includes(
          body.sync_direction as SyncDirection
        )
      ) {
        return NextResponse.json(
          { error: "Invalid sync direction" },
          { status: 400 }
        );
      }

      updates.sync_direction = body.sync_direction;
    }

    if (body?.config !== undefined) {
      if (
        typeof body.config !== "object" ||
        body.config === null ||
        Array.isArray(body.config)
      ) {
        return NextResponse.json(
          { error: "Config must be an object" },
          { status: 400 }
        );
      }

      updates.config = body.config;
    }

    if (body?.last_error !== undefined) {
      updates.last_error =
        body.last_error === null
          ? null
          : typeof body.last_error === "string"
            ? body.last_error
            : existing.last_error;
    }

    if (Object.keys(updates).length === 0) {
      const safeIntegration = Object.fromEntries(
        SAFE_FIELD_LIST.map((field) => [
          field,
          existing[field],
        ])
      );

      return NextResponse.json({
        integration: safeIntegration,
      });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("integrations")
      .update(updates)
      .eq("id", id)
      .eq("dealership_id", profile.dealership_id)
      .select(SAFE_FIELDS)
      .single();

    if (error) {
      console.error("PATCH /api/integrations/[id]:", error);

      if (error.code === "23505") {
        return NextResponse.json(
          { error: "An integration with the same provider and name already exists" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Unable to update integration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ integration: data });
  } catch (error) {
    console.error("PATCH /api/integrations/[id] exception:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
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

    if (!isManagerOrAdmin(profile.role)) {
      return NextResponse.json(
        { error: "Only managers and admins can manage integrations" },
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

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("integrations")
      .delete()
      .eq("id", id)
      .eq("dealership_id", profile.dealership_id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("DELETE /api/integrations/[id]:", error);

      return NextResponse.json(
        { error: "Unable to delete integration" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      id: data.id,
    });
  } catch (error) {
    console.error("DELETE /api/integrations/[id] exception:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}





