import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({
        loggedIn: false,
        dealershipName: null,
      });
    }

    const profile = await getCurrentUserProfile();

    if (!profile) {
      return NextResponse.json({
        loggedIn: true,
        dealershipName: null,
      });
    }

    let dealershipName: string | null = null;

    if (profile.dealership_id) {
      const { data: dealership } = await supabase
        .from("dealerships")
        .select("name")
        .eq("id", profile.dealership_id)
        .maybeSingle();

      dealershipName = dealership?.name ?? null;
    }

    return NextResponse.json({
      loggedIn: true,
      dealershipName,
    });
  } catch (error) {
    console.error("Auth session API error:", error);

    return NextResponse.json(
      {
        loggedIn: false,
        dealershipName: null,
        error: "Unable to check session.",
      },
      { status: 500 }
    );
  }
}
