// lib/supabaseBrowser.ts
//
// Supabase client for use inside Client Components ("use client"). Uses
// @supabase/ssr so auth cookies stay in sync with the server client and
// middleware (Blueprint §4, §47 Phase 2).

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
