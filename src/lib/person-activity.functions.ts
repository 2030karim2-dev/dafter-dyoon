/** Per-customer activity log — thin server-function wrapper. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { loadPersonActivity } from "@/lib/person/activity.server";

export type { ActivityItem, ActivityKind } from "@/lib/person/activity.server";

export const getPersonActivityFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ person_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) =>
    loadPersonActivity(context.supabase, context.userId, data.person_id),
  );
