import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ token: string }>;
};

type InviteRow = {
  email: string;
  role: string;
  dealership_name: string | null;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const { token } = await params;

  if (!token || !token.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing invite token.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }

  const cleanToken = token.trim();

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .rpc("get_dealership_invite", {
      p_token: cleanToken,
    })
    .maybeSingle<InviteRow>();

  if (error) {
    console.error("Invite lookup error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to look up invite.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        success: false,
        error: "This invite is invalid or has expired.",
      },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }

  const email = String(data.email ?? "")
    .trim()
    .toLowerCase();

  return NextResponse.json(
    {
      success: true,
      email,
      role: data.role,
      dealershipName:
        data.dealership_name?.trim() || "your dealership",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}