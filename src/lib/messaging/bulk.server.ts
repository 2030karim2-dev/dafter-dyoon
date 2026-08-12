/**
 * Server-only bulk messaging: queue reminders for many customers and try to
 * deliver them in one pass.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBoard, markDelivered, signatureOf } from "@/lib/followup/engine.server";
import {
  dedupeKey,
  kindForBucket,
  normalizePhone,
  renderTemplate,
  templateBody,
  varsForBucket,
} from "@/lib/messaging/render.server";
import { deliver } from "@/lib/messaging/providers.server";

type DB = SupabaseClient;
type Channel = "whatsapp" | "telegram" | "sms";

export interface BulkTarget {
  person_id: string;
  currency_id: string;
}

export interface BulkResult {
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * @param mode "queue" only fills the outbox, "send" also attempts delivery,
 *             "manual" marks messages as sent (user sends them by hand).
 */
export async function bulkMessages(
  supabase: DB,
  userId: string,
  targets: BulkTarget[],
  channel: Channel,
  mode: "queue" | "send" | "manual",
): Promise<BulkResult> {
  const board = await loadBoard(supabase, userId);
  const [tplRes, compRes, chRes] = await Promise.all([
    supabase.from("message_templates").select("kind,body,is_active").eq("user_id", userId),
    supabase.from("company_profile").select("name").eq("user_id", userId).maybeSingle(),
    supabase
      .from("channel_settings")
      .select("whatsapp_from,sms_from,telegram_chat_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const signature = signatureOf(board.channels, compRes.data?.name ?? null);
  const templates = tplRes.data ?? [];

  const rows = targets
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
        channel,
        kind,
        body: renderTemplate(templateBody(templates, kind), varsForBucket(bucket, signature)),
        destination:
          channel === "telegram"
            ? (chRes.data?.telegram_chat_id ?? board.channels?.telegram_chat_id ?? null)
            : normalizePhone(bucket.phone),
        status: "queued",
        dedupe_key: dedupeKey(bucket.person_id, kind, channel),
      };
    });

  const result: BulkResult = {
    queued: 0,
    sent: 0,
    failed: 0,
    skipped: targets.length - rows.length,
    errors: [],
  };
  if (!rows.length) return result;

  const { data: inserted, error } = await supabase
    .from("outbox")
    .upsert(rows, { onConflict: "user_id,dedupe_key" })
    .select("id,channel,body,destination,attempts");
  if (error) throw new Error(error.message);
  const queued = inserted ?? [];
  result.queued = queued.length;
  if (mode === "queue") return result;

  for (const row of queued) {
    if (mode === "manual") {
      await markDelivered(supabase, userId, row.id, "manual");
      result.sent += 1;
      continue;
    }
    if (!row.destination) {
      result.failed += 1;
      if (result.errors.length < 3) result.errors.push("لا توجد وجهة إرسال لبعض العملاء");
      continue;
    }
    const res = await deliver(row.channel, row.destination, row.body, {
      whatsappFrom: chRes.data?.whatsapp_from ?? null,
      smsFrom: chRes.data?.sms_from ?? null,
    });
    if (res.ok) {
      await markDelivered(supabase, userId, row.id, res.ref ?? null);
      result.sent += 1;
    } else {
      result.failed += 1;
      await supabase
        .from("outbox")
        .update({
          attempts: (row.attempts ?? 0) + 1,
          last_error: res.error ?? "فشل الإرسال",
          status: res.unavailable ? "queued" : (row.attempts ?? 0) >= 3 ? "failed" : "queued",
        })
        .eq("id", row.id);
      if (res.error && result.errors.length < 3) result.errors.push(res.error);
    }
  }
  return result;
}
