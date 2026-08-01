/**
 * Messaging server functions — thin wrappers only.
 * Rendering lives in ./messaging/render.server.ts, delivery in
 * ./messaging/providers.server.ts, queue logic in ./followup/engine.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { loadBoard, markDelivered, signatureOf } from "@/lib/followup/engine.server";
import {
  dedupeKey,
  kindForBucket,
  normalizePhone,
  renderTemplate,
  templateBody,
  varsForBucket,
} from "@/lib/messaging/render.server";
import { deliver, channelAvailability } from "@/lib/messaging/providers.server";
import { bulkMessages } from "@/lib/messaging/bulk.server";

export interface OutboxRow {
  id: string;
  person_id: string | null;
  channel: string;
  kind: string;
  body: string;
  destination: string | null;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  person_name?: string | null;
}

/** Outbox list with person names resolved on the server. */
export const getOutboxFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: OutboxRow[]; availability: ReturnType<typeof channelAvailability> }> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("outbox")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(300);
    const rows = (data ?? []) as OutboxRow[];
    const ids = [...new Set(rows.map((r) => r.person_id).filter(Boolean))] as string[];
    const { data: people } = ids.length
      ? await supabase.from("people").select("id,name").in("id", ids)
      : { data: [] as { id: string; name: string }[] };
    const nameOf = new Map((people ?? []).map((p) => [p.id, p.name]));
    return {
      rows: rows.map((r) => ({ ...r, person_name: r.person_id ? nameOf.get(r.person_id) ?? null : null })),
      availability: channelAvailability(),
    };
  });

/** Build (and optionally queue) a message for one customer bucket. */
export const buildMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        person_id: z.string().uuid(),
        currency_id: z.string().uuid(),
        kind: z.string().min(2).max(40).optional(),
        enqueue: z.boolean().optional(),
        channel: z.enum(["whatsapp", "telegram", "sms"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const board = await loadBoard(supabase, userId);
    const bucket = board.buckets.find(
      (b) => b.person_id === data.person_id && b.currency_id === data.currency_id,
    );
    if (!bucket) throw new Error("لا يوجد رصيد مستحق لهذا العميل بهذه العملة");

    const [tplRes, compRes] = await Promise.all([
      supabase.from("message_templates").select("kind,body,is_active").eq("user_id", userId),
      supabase.from("company_profile").select("name").eq("user_id", userId).maybeSingle(),
    ]);
    const signature = signatureOf(board.channels, compRes.data?.name ?? null);
    const kind = data.kind ?? kindForBucket(bucket);
    const body = renderTemplate(
      templateBody(tplRes.data ?? [], kind),
      varsForBucket(bucket, signature),
    );
    const channel = data.channel ?? "whatsapp";
    const destination = channel === "telegram" ? board.channels?.telegram_chat_id ?? null : normalizePhone(bucket.phone);

    let outbox_id: string | null = null;
    if (data.enqueue) {
      const { data: row } = await supabase
        .from("outbox")
        .upsert(
          {
            user_id: userId,
            person_id: bucket.person_id,
            transaction_id: bucket.transaction_id,
            channel,
            kind,
            body,
            destination,
            status: "queued",
            dedupe_key: dedupeKey(bucket.person_id, kind, channel),
          },
          { onConflict: "user_id,dedupe_key" },
        )
        .select("id")
        .maybeSingle();
      outbox_id = row?.id ?? null;
    }
    return { body, kind, channel, destination, outbox_id, name: bucket.name };
  });

/** Queue reminders for a list of customers at once (bulk follow-up). */
export const enqueueMessagesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        targets: z
          .array(z.object({ person_id: z.string().uuid(), currency_id: z.string().uuid() }))
          .min(1)
          .max(500),
        channel: z.enum(["whatsapp", "telegram", "sms"]).default("whatsapp"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const board = await loadBoard(supabase, userId);
    const [tplRes, compRes] = await Promise.all([
      supabase.from("message_templates").select("kind,body,is_active").eq("user_id", userId),
      supabase.from("company_profile").select("name").eq("user_id", userId).maybeSingle(),
    ]);
    const signature = signatureOf(board.channels, compRes.data?.name ?? null);
    const templates = tplRes.data ?? [];

    const rows = data.targets
      .map((t) =>
        board.buckets.find((b) => b.person_id === t.person_id && b.currency_id === t.currency_id),
      )
      .filter(Boolean)
      .map((b) => {
        const bucket = b!;
        const kind = kindForBucket(bucket);
        return {
          user_id: userId,
          person_id: bucket.person_id,
          transaction_id: bucket.transaction_id,
          channel: data.channel,
          kind,
          body: renderTemplate(templateBody(templates, kind), varsForBucket(bucket, signature)),
          destination:
            data.channel === "telegram"
              ? board.channels?.telegram_chat_id ?? null
              : normalizePhone(bucket.phone),
          status: "queued",
          dedupe_key: dedupeKey(bucket.person_id, kind, data.channel),
        };
      });

    if (!rows.length) return { queued: 0 };
    const { data: inserted, error } = await supabase
      .from("outbox")
      .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    return { queued: inserted?.length ?? 0 };
  });

/** Bulk follow-up: queue + deliver (or mark manual) for many customers. */
export const sendBulkMessagesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        targets: z
          .array(z.object({ person_id: z.string().uuid(), currency_id: z.string().uuid() }))
          .min(1)
          .max(500),
        channel: z.enum(["whatsapp", "telegram", "sms"]).default("whatsapp"),
        mode: z.enum(["queue", "send", "manual"]).default("send"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    bulkMessages(context.supabase, context.userId, data.targets, data.channel, data.mode),
  );

/** Mark a queued message as sent (used after a manual WhatsApp send). */
export const markSentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ok = await markDelivered(context.supabase, context.userId, data.id, "manual");
    if (!ok) throw new Error("الرسالة غير موجودة");
    return { ok: true };
  });

/** Try to deliver a single queued message through its provider. */
export const sendOutboxFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("outbox")
      .select("id,channel,body,destination,attempts")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("الرسالة غير موجودة");
    if (!row.destination) throw new Error("لا توجد وجهة للإرسال (رقم أو معرّف محادثة)");
    const { data: ch } = await supabase
      .from("channel_settings")
      .select("whatsapp_from,sms_from")
      .eq("user_id", userId)
      .maybeSingle();
    const res = await deliver(row.channel, row.destination, row.body, {
      whatsappFrom: ch?.whatsapp_from ?? null,
      smsFrom: ch?.sms_from ?? null,
    });
    if (res.ok) {
      await markDelivered(supabase, userId, row.id, res.ref ?? null);
      return { ok: true };
    }
    await supabase
      .from("outbox")
      .update({
        attempts: row.attempts + 1,
        last_error: res.error ?? "فشل الإرسال",
        status: res.unavailable ? "queued" : row.attempts >= 3 ? "failed" : "queued",
      })
      .eq("id", row.id);
    return { ok: false, error: res.error ?? "فشل الإرسال", unavailable: res.unavailable ?? false };
  });

/** Remove a message from the outbox. */
export const deleteOutboxFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("outbox")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Contact history for one customer (person timeline). */
export const getContactHistoryFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ person_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("message_log")
      .select("id,channel,kind,body,sent_at")
      .eq("user_id", context.userId)
      .eq("person_id", data.person_id)
      .order("sent_at", { ascending: false })
      .limit(50);
    return rows ?? [];
  });

/** Generate a one-time Telegram link code for the owner's bot. */
export const createTelegramLinkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const code = `DFT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { error } = await context.supabase
      .from("channel_settings")
      .upsert(
        { user_id: context.userId, telegram_link_code: code, telegram_enabled: true },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { code };
  });

/** Send a test message to the owner's Telegram chat. */
export const testTelegramFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ch } = await context.supabase
      .from("channel_settings")
      .select("telegram_chat_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!ch?.telegram_chat_id) throw new Error("لم يتم ربط محادثة تليجرام بعد");
    const res = await deliver("telegram", ch.telegram_chat_id, "✅ تم ربط دفترك بتليجرام بنجاح.", {
      whatsappFrom: null,
      smsFrom: null,
    });
    if (!res.ok) throw new Error(res.error ?? "فشل الإرسال");
    return { ok: true };
  });
