// NOTE: kept for backward compatibility. New code should use
// lib/supabaseBrowser.ts (Client Components) or lib/supabaseServer.ts
// (Route Handlers/Server Components) instead — those carry the user's
// session so Postgres RLS can scope data to their dealership. This plain
// anon client has no session and will only see rows RLS allows to
// anonymous/public access.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);