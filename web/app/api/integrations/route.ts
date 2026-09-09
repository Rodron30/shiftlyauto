import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";
import type {
  IntegrationType,
  SyncDirection,
} from "@/lib/integrations/types";
import {
  getIntegrationProviders,
} from "@/lib/integrations/providers";
import {
  getSaasLimit,
  getSaasLimitError,
  requireSaasAccess,
} from "@/lib/saas";

const INTEGRATION_TYPES: IntegrationType[] = [
  "DMS",
  "CRM",
  "INVENTORY",
  "DEALER_WEBSITE",
  "ACCOUNTING",
];

const SYNC_DIRECTIONS: SyncDirection[] = [
  "IMPORT",
  "EXPORT",
  "TWO_WAY",
];

function isManagerOrAdmin(role: unknown): boolean {
  return role === "admin" || role === "manager";
}

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("integrations")
      .select(
        [
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
        ].join(",")
      )
      .eq("dealership_id", profile.dealership_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET /api/integrations:", error);

      return NextResponse.json(
        { error: "Unable to load integrations" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      integrations: data ?? [],
      providers: getIntegrationProviders(),
    });
  } catch (error) {
    console.error("GET /api/integrations exception:", error);

    return NextResponse.json(
      { error: "Internal server error" },
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

    if (!isManagerOrAdmin(profile.role)) {
      return NextResponse.json(
        {
          error:
            "Only managers and admins can manage integrations",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const integrationType = body?.integration_type;
    const provider = body?.provider;
    const name = body?.name;
    const syncDirection = body?.sync_direction ?? "TWO_WAY";

    const config =
      body?.config &&
      typeof body.config === "object" &&
      !Array.isArray(body.config)
        ? body.config
        : {};

    if (
      typeof integrationType !== "string" ||
      !INTEGRATION_TYPES.includes(
        integrationType as IntegrationType
      )
    ) {
      return NextResponse.json(
        { error: "Invalid integration type" },
        { status: 400 }
      );
    }

    if (
      typeof provider !== "string" ||
      !provider.trim()
    ) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (
      typeof syncDirection !== "string" ||
      !SYNC_DIRECTIONS.includes(
        syncDirection as SyncDirection
      )
    ) {
      return NextResponse.json(
        { error: "Invalid sync direction" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const saasAccess = await requireSaasAccess();

    if (!saasAccess.ok) {
      return NextResponse.json(
        {
          error: saasAccess.error,
        },
        { status: saasAccess.status }
      );
    }

    const integrationLimit = getSaasLimit(
      saasAccess.context.plan,
      "integrations"
    );

    if (integrationLimit !== null) {
      const {
        count: configuredIntegrationCount,
        error: integrationCountError,
      } = await supabase
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
            error:
              "Failed to check integration plan limit.",
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

    const { data, error } = await supabase
      .from("integrations")
      .insert({
        dealership_id: profile.dealership_id,
        integration_type: integrationType,
        provider: provider.trim(),
        name: name.trim(),
        sync_direction: syncDirection,
        config,
        created_by: profile.id,
      })
      .select(
        [
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
        ].join(",")
      )
      .single();

    if (error) {
      console.error("POST /api/integrations:", error);

      if (error.code === "23505") {
        return NextResponse.json(
          {
            error:
              "An integration with the same provider and name already exists",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Unable to create integration" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { integration: data },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "POST /api/integrations exception:",
      error
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}