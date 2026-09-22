import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=Could not verify your link. Please try again.`
    );
  }

  const supabase = await createSupabaseServerClient();

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("Auth callback exchange error:", exchangeError);

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "Could not verify your link. Please try again."
      )}`
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Auth callback user lookup error:", userError);

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "Could not load your account. Please try again."
      )}`
    );
  }

  /*
   * The handle_new_user() trigger in the database handles all user provisioning:
   * - Customer self-signup via dealership code (role = customer)
   * - Team member signup via invite token (role = manager/salesperson)
   * - Dealership owner signup (role = admin)
   * 
   * The trigger runs automatically when auth.users row is created.
   * No additional RPC calls needed here.
   */

  return NextResponse.redirect(`${origin}${next}`);
}

