import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function getCurrentPlatformAdmin() {
  const profile = await getCurrentUserProfile();

  if (!profile?.id) {
    return null;
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("platform_admins")
    .select("user_id, role, is_active")
    .eq("user_id", profile.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

// Re-export for convenience - consolidated to avoid duplication
export { createSupabaseAdminClient as createSupabaseServiceRoleClient };
