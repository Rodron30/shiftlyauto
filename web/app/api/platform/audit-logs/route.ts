import { NextResponse } from "next/server";

import {
  createSupabaseServiceRoleClient,
  getCurrentPlatformAdmin,
} from "@/lib/platform";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);

    const requestedLimit = Number(
      searchParams.get("limit") ?? DEFAULT_LIMIT
    );

    const requestedOffset = Number(
      searchParams.get("offset") ?? 0
    );

    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    const offset =
      Number.isFinite(requestedOffset) && requestedOffset >= 0
        ? Math.floor(requestedOffset)
        : 0;

    const supabase = createSupabaseServiceRoleClient();

    const {
      data: logs,
      error,
      count,
    } = await supabase
      .from("platform_audit_logs")
      .select(
        "id, actor_user_id, action, target_type, target_id, metadata, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error(
        "Platform audit logs query error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load platform audit logs.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      logs: logs ?? [],
      pagination: {
        limit,
        offset,
        total: count ?? 0,
        hasMore: (count ?? 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error(
      "Platform audit logs API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load platform audit logs.",
      },
      { status: 500 }
    );
  }
}
