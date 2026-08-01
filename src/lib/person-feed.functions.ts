/** Unified customer feed — thin server-function wrapper. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { loadPersonFeed } from "@/lib/person/feed.server";

export type { FeedItem, FeedKind } from "@/lib/person/feed.server";

export const getPersonFeedFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      person_id: z.string().uuid(),
      currency_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) =>
    loadPersonFeed(context.supabase, context.userId, data.person_id, data.currency_id ?? null),
  );
