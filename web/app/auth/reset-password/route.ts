import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          "Invalid or expired password reset link. Please request a new one."
        )}`,
        origin
      )
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error(
        "Password recovery code exchange error:",
        error
      );

      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(
            "This password reset link is invalid or expired. Please request a new one."
          )}`,
          origin
        )
      );
    }

    return NextResponse.redirect(
      new URL("/reset-password", origin)
    );
  } catch (error) {
    console.error(
      "Password recovery callback error:",
      error
    );

    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          "Unable to process the password reset link. Please request a new one."
        )}`,
        origin
      )
    );
  }
}