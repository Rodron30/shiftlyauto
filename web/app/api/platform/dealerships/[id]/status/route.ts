import { NextResponse } from "next/server";

import {
  createSupabaseServiceRoleClient,
  getCurrentPlatformAdmin,
} from "@/lib/platform";

import { writePlatformAuditLog } from "@/lib/platformAudit";

const ALLOWED_STATUSES = [
  "ACTIVE",
  "TRIAL",
  "SUSPENDED",
  "CANCELED",
] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function isAllowedStatus(value: unknown): value is AllowedStatus {
  return (
    typeof value === "string" &&
    ALLOWED_STATUSES.includes(value as AllowedStatus)
  );
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const platformAdmin = await getCurrentPlatformAdmin();

    if (!platformAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Platform administrator access required.",
        },
        { status: 403 }
      );
    }

    if (platformAdmin.role !== "PLATFORM_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error: "Platform administrator role required.",
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Dealership ID is required.",
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const status = body?.status;

    if (!isAllowedStatus(status)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid SaaS status. Allowed values: ACTIVE, TRIAL, SUSPENDED, CANCELED.",
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceRoleClient();

    const { data: dealership, error: dealershipLookupError } =
      await supabase
        .from("dealerships")
        .select("id, name, saas_status")
        .eq("id", id)
        .maybeSingle();

    if (dealershipLookupError) {
      console.error(
        "Platform dealership lookup error:",
        dealershipLookupError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load dealership.",
        },
        { status: 500 }
      );
    }

    if (!dealership) {
      return NextResponse.json(
        {
          success: false,
          error: "Dealership not found.",
        },
        { status: 404 }
      );
    }

    const previousStatus = dealership.saas_status;

    if (previousStatus === status) {
      return NextResponse.json({
        success: true,
        changed: false,
        dealership: {
          id: dealership.id,
          name: dealership.name,
          saas_status: dealership.saas_status,
        },
      });
    }

    const updatePayload: {
      saas_status: AllowedStatus;
      trial_ends_at?: string | null;
    } = {
      saas_status: status,
    };

    if (status !== "TRIAL") {
      updatePayload.trial_ends_at = null;
    }

    const { data: updatedDealership, error: updateError } =
      await supabase
        .from("dealerships")
        .update(updatePayload)
        .eq("id", id)
        .select("id, name, saas_status, trial_ends_at")
        .single();

    if (updateError) {
      console.error(
        "Platform dealership status update error:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to update dealership status.",
        },
        { status: 500 }
      );
    }

    await writePlatformAuditLog({
      actorUserId: platformAdmin.user_id,
      action: "DEALERSHIP_STATUS_CHANGED",
      targetType: "DEALERSHIP",
      targetId: dealership.id,
      metadata: {
        dealership_name: dealership.name,
        previous_status: previousStatus,
        new_status: status,
      },
    });

    return NextResponse.json({
      success: true,
      changed: true,
      dealership: updatedDealership,
    });
  } catch (error) {
    console.error(
      "Platform dealership status API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update dealership status.",
      },
      { status: 500 }
    );
  }
}

