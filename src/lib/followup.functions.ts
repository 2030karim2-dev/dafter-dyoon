/**
 * Follow-up server functions — thin wrappers only.
 * All computation lives in ./followup/board.server.ts and ./followup/engine.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { loadBoard, runFollowupCycle } from "@/lib/followup/engine.server";
import { DEFAULT_POLICY } from "@/lib/followup/board.server";
import { channelAvailability } from "@/lib/messaging/providers.server";

export type {
  BoardBucket,
  BoardCounts,
  BoardTotal,
  ChannelRow,
  FollowupBoard,
  PolicyRow,
  Severity,
} from "@/lib/followup/board.server";

/** Whole follow-up board, computed on the server. */
export const getFollowupBoardFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const board = await loadBoard(context.supabase, context.userId);
    return { ...board, availability: channelAvailability() };
  });

/** Run the queue cycle now (queue due reminders + attempt auto delivery). */
export const runFollowupCycleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    runFollowupCycle(context.supabase, context.userId, { deliverNow: true }),
  );

/** Follow-up policy + channel settings for the settings screens. */
export const getFollowupSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [pol, ch, tpl, comp] = await Promise.all([
      supabase.from("followup_policies").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("channel_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("message_templates")
        .select("id,kind,title,body,is_active")
        .eq("user_id", userId)
        .order("kind"),
      supabase.from("company_profile").select("name").eq("user_id", userId).maybeSingle(),
    ]);
    return {
      policy: pol.data ?? { user_id: userId, ...DEFAULT_POLICY },
      channels: ch.data ?? null,
      templates: tpl.data ?? [],
      company_name: comp.data?.name ?? null,
      availability: channelAvailability(),
    };
  });

const policySchema = z.object({
  days_before: z.number().int().min(0).max(60),
  overdue_every_days: z.number().int().min(1).max(90),
  max_reminders: z.number().int().min(1).max(30),
  quiet_start: z.number().int().min(0).max(23),
  quiet_end: z.number().int().min(0).max(23),
  auto_send: z.boolean(),
  daily_digest: z.boolean(),
});

export const saveFollowupPolicyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => policySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("followup_policies")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const channelSchema = z.object({
  whatsapp_enabled: z.boolean(),
  whatsapp_auto: z.boolean(),
  whatsapp_from: z.string().max(30).nullable(),
  telegram_enabled: z.boolean(),
  sms_enabled: z.boolean(),
  sms_from: z.string().max(30).nullable(),
  signature_name: z.string().max(120).nullable(),
});

export const saveChannelSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => channelSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("channel_settings")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const templateSchema = z.object({
  kind: z.string().min(2).max(40),
  title: z.string().min(1).max(120),
  body: z.string().min(5).max(2000),
  is_active: z.boolean(),
});

export const saveTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => templateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("message_templates")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id,kind" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
