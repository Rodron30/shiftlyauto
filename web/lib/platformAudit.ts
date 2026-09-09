import {
  createSupabaseServiceRoleClient,
} from "@/lib/platform";

type PlatformAuditInput = {
  actorUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

export async function writePlatformAuditLog(
  input: PlatformAuditInput
) {
  const supabase = createSupabaseServiceRoleClient();

  const { error } = await supabase
    .from("platform_audit_logs")
    .insert({
      actor_user_id: input.actorUserId,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      metadata: input.metadata ?? {},
    });

  if (error) {
    console.error("Platform audit log error:", error);
    throw new Error("Failed to write platform audit log.");
  }
}
