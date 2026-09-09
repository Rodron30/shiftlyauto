// lib/supabaseServer.ts
//
// Supabase client for Route Handlers and Server Components. Reads/writes
// the auth cookies set by middleware.ts so requests carry the logged-in
// user's session, which is what lets Postgres RLS policies scope every
// query to that user's dealership_id (Blueprint §5, §44: dealer-level
// data isolation).

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component with no response to write to
            // (middleware already refreshes the session). Safe to ignore.
          }
        },
      },
    }
  );
}

/**
 * Returns the signed-in user's profile row (id, dealership_id, role, ...)
 * or null if there is no session / no matching profile yet.
 */
export async function getCurrentUserProfile() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("users")
    .select("id, dealership_id, name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getCurrentUserProfile error:", error);
    return null;
  }

  return profile;
}
