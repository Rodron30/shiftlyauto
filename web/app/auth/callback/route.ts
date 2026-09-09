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

  const inviteToken =
    typeof user.user_metadata?.invite_token === "string"
      ? user.user_metadata.invite_token.trim()
      : "";

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";

  /*
   * FLOW 1:
   * User joined an existing dealership through an invitation.
   */
  if (inviteToken) {
    const { error: inviteError } = await supabase.rpc(
      "accept_dealership_invite",
      {
        p_token: inviteToken,
        p_full_name: fullName,
      }
    );

    if (inviteError) {
      console.error(
        "Dealership invite acceptance error:",
        inviteError
      );

      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(
          "Your email was verified, but we could not finish joining the dealership. Please contact your dealership admin."
        )}`
      );
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  /*
   * FLOW 2:
   * User created a brand-new dealership.
   *
   * The signup page stores dealership_name and full_name
   * in Supabase Auth metadata. After email verification,
   * create the dealership and the owner/admin profile.
   */
  const dealershipName =
    typeof user.user_metadata?.dealership_name === "string"
      ? user.user_metadata.dealership_name.trim()
      : "";

  if (dealershipName) {
    const { error: dealershipError } = await supabase.rpc(
      "create_dealership_for_current_user",
      {
        p_dealership_name: dealershipName,
        p_full_name: fullName,
      }
    );

    if (dealershipError) {
      console.error(
        "Dealership creation error:",
        dealershipError
      );

      /*
       * If the account already has a Shiftly profile,
       * don't create another dealership.
       *
       * This can happen if the callback is opened again
       * after the account has already been provisioned.
       */
      if (
        dealershipError.message.includes(
          "already has a Shiftly user profile"
        )
      ) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(
          "Your email was verified, but we could not finish setting up your dealership. Please try signing in again."
        )}`
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}

