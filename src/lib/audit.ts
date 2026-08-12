import { supabase } from "@/integrations/supabase/client";

export async function logAudit(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await supabase.from("audit_log").insert({
      user_id: userId,
      action,
      entity,
      entity_id: entityId ?? null,
      metadata: (metadata ?? null) as never,
    });
  } catch {
    // best-effort, do not surface to user
  }
}
