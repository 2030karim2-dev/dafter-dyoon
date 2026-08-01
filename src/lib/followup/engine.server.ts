/**
 * Server-only follow-up queue engine.
 * Given any Supabase client (user-scoped or admin) and a user id, it:
 *   1. computes the board,
 *   2. decides which reminders are due per the user's policy,
 *   3. writes them into `outbox` (idempotent via dedupe_key),
 *   4. optionally delivers whatever can be sent automatically.
 * Shared by the authenticated server functions and the cron route.
 */
import {
  buildBoard,
  DEFAULT_POLICY,
  type BoardBucket,
  type ChannelRow,
  type FollowupBoard,
  type PolicyRow,
} from "@/lib/followup/board.server";
import {
  dedupeKey,
  gDate,
  inQuietHours,
  kindForBucket,
  money,
  normalizePhone,
  renderTemplate,
  templateBody,
  varsForBucket,
} from "@/lib/messaging/render.server";
import { deliver } from "@/lib/messaging/providers.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

export async function loadBoard(supabase: Client, userId: string): Promise<FollowupBoard> {
  const [txRes, pRes, cRes, logRes, polRes, chRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id,person_id,amount,direction,currency_id,due_date,is_paid")
      .eq("user_id", userId)
      .eq("is_paid", false),
    supabase
      .from("people")
      .select("id,name,phone,credit_limit,avatar_color")
      .eq("user_id", userId)
      .eq("is_archived", false),
    supabase.from("currencies").select("id,name,symbol").eq("user_id", userId),
    supabase
      .from("message_log")
      .select("person_id,sent_at")
      .eq("user_id", userId)
      .order("sent_at", { ascending: false })
      .limit(2000),
    supabase.from("followup_policies").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("channel_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  return buildBoard({
    txs: txRes.data ?? [],
    people: pRes.data ?? [],
    currencies: cRes.data ?? [],
    contacts: logRes.data ?? [],
    policy: (polRes.data as PolicyRow | null) ?? null,
    channels: (chRes.data as ChannelRow | null) ?? null,
  });
}

export function signatureOf(channels: ChannelRow | null, companyName?: string | null): string {
  return channels?.signature_name || companyName || "دفترك";
}

/** Should this bucket get a reminder today, given the policy and history? */
export function shouldRemind(b: BoardBucket, policy: PolicyRow, sentDays: number[]): boolean {
  if (b.severity === "ok") return false;
  if (b.days_overdue === -99999) return false;
  if (sentDays.length >= policy.max_reminders) return false;
  if (b.days_overdue < 0) {
    // upcoming: only exactly at the "days_before" checkpoint
    return -b.days_overdue <= policy.days_before && sentDays.length === 0;
  }
  if (b.days_overdue === 0) return true;
  const every = Math.max(1, policy.overdue_every_days);
  return b.days_overdue % every === 0;
}

export interface EngineStats {
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
}

/** Queue reminders for every bucket that is due, then try automatic delivery. */
export async function runFollowupCycle(
  supabase: Client,
  userId: string,
  opts: { deliverNow?: boolean } = {},
): Promise<EngineStats> {
  const stats: EngineStats = { queued: 0, sent: 0, failed: 0, skipped: 0 };
  const board = await loadBoard(supabase, userId);
  const policy: PolicyRow = board.policy ?? ({ user_id: userId, ...DEFAULT_POLICY } as PolicyRow);
  const channels = board.channels;
  if (channels && !channels.whatsapp_enabled && !channels.sms_enabled) return stats;

  const [tplRes, compRes] = await Promise.all([
    supabase.from("message_templates").select("kind,body,is_active").eq("user_id", userId),
    supabase.from("company_profile").select("name").eq("user_id", userId).maybeSingle(),
  ]);
  const templates = tplRes.data ?? [];
  const signature = signatureOf(channels, compRes.data?.name ?? null);

  // history: how many reminders already sent per person
  const { data: hist } = await supabase
    .from("message_log")
    .select("person_id,sent_at")
    .eq("user_id", userId)
    .in("kind", ["upcoming", "due_today", "overdue"]);
  const perPerson = new Map<string, number[]>();
  for (const h of hist ?? []) {
    if (!h.person_id) continue;
    const arr = perPerson.get(h.person_id) ?? [];
    arr.push(new Date(h.sent_at).getTime());
    perPerson.set(h.person_id, arr);
  }

  const channel = channels?.sms_enabled && !channels?.whatsapp_enabled ? "sms" : "whatsapp";
  const rows: Record<string, unknown>[] = [];

  for (const b of board.buckets) {
    const history = perPerson.get(b.person_id) ?? [];
    if (!shouldRemind(b, policy, history)) {
      stats.skipped++;
      continue;
    }
    const kind = kindForBucket(b);
    const body = renderTemplate(templateBody(templates, kind), varsForBucket(b, signature));
    rows.push({
      user_id: userId,
      person_id: b.person_id,
      transaction_id: b.transaction_id,
      channel,
      kind,
      body,
      destination: normalizePhone(b.phone),
      status: "queued",
      scheduled_at: new Date().toISOString(),
      dedupe_key: dedupeKey(b.person_id, kind, channel),
    });
  }

  if (rows.length) {
    const { data, error } = await supabase
      .from("outbox")
      .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (!error) stats.queued = data?.length ?? 0;
    else console.error("[engine] outbox upsert", error.message);
  }

  if (opts.deliverNow && channels) {
    const auto = await flushOutbox(supabase, userId, channels, policy);
    stats.sent += auto.sent;
    stats.failed += auto.failed;
  }
  return stats;
}

/** Try to deliver queued messages that can be sent automatically. */
export async function flushOutbox(
  supabase: Client,
  userId: string,
  channels: ChannelRow,
  policy: PolicyRow,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  if (inQuietHours(policy.quiet_start, policy.quiet_end)) return { sent, failed };
  if (!channels.whatsapp_auto && !channels.sms_enabled) return { sent, failed };

  const { data: queue } = await supabase
    .from("outbox")
    .select("id,channel,body,destination,attempts")
    .eq("user_id", userId)
    .eq("status", "queued")
    .lte("scheduled_at", new Date().toISOString())
    .lt("attempts", 4)
    .limit(60);

  for (const row of queue ?? []) {
    if (row.channel === "whatsapp" && !channels.whatsapp_auto) continue;
    if (row.channel === "sms" && !channels.sms_enabled) continue;
    if (!row.destination) continue;
    const res = await deliver(row.channel, row.destination, row.body, {
      whatsappFrom: channels.whatsapp_from,
      smsFrom: channels.sms_from,
    });
    if (res.ok) {
      sent++;
      await markDelivered(supabase, userId, row.id, res.ref ?? null);
    } else if (res.unavailable) {
      continue; // leave queued for manual sending
    } else {
      failed++;
      await supabase
        .from("outbox")
        .update({
          status: row.attempts >= 3 ? "failed" : "queued",
          attempts: row.attempts + 1,
          last_error: res.error ?? "فشل الإرسال",
          scheduled_at: new Date(Date.now() + (row.attempts + 1) * 3600_000).toISOString(),
        })
        .eq("id", row.id);
    }
  }
  return { sent, failed };
}

/** Mark an outbox row as sent and mirror it into the permanent log. */
export async function markDelivered(
  supabase: Client,
  userId: string,
  outboxId: string,
  providerRef: string | null,
) {
  const { data: row } = await supabase
    .from("outbox")
    .select("id,person_id,channel,kind,body,destination")
    .eq("id", outboxId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return false;
  const now = new Date().toISOString();
  await supabase
    .from("outbox")
    .update({ status: "sent", sent_at: now, last_error: null })
    .eq("id", outboxId)
    .eq("user_id", userId);
  await supabase.from("message_log").insert({
    user_id: userId,
    person_id: row.person_id,
    outbox_id: row.id,
    channel: row.channel,
    kind: row.kind,
    body: row.body,
    destination: row.destination,
    sent_at: now,
    provider_ref: providerRef,
  });
  return true;
}

/** Owner digest text for Telegram. */
export function digestText(board: FollowupBoard, signature: string): string {
  const lines: string[] = [];
  lines.push(`📊 ملخص المتابعة — ${gDate(new Date().toISOString())}`);
  lines.push("");
  lines.push(`• يستحق اليوم: ${board.counts.due}`);
  lines.push(`• متأخر: ${board.counts.late}`);
  lines.push(`• حرج: ${board.counts.critical}`);
  lines.push(`• قريباً: ${board.counts.soon}`);
  if (board.totals.length) {
    lines.push("");
    lines.push("المبالغ المعرّضة للخطر:");
    for (const t of board.totals) lines.push(`  - ${money(t.amount)} ${t.symbol}`);
  }
  const top = board.buckets.filter((b) => b.severity !== "ok").slice(0, 5);
  if (top.length) {
    lines.push("");
    lines.push("أعلى 5 عملاء:");
    top.forEach((b, i) =>
      lines.push(
        `  ${i + 1}. ${b.name} — ${money(b.net)} ${b.currency_symbol}${
          b.days_overdue > 0 ? ` (متأخر ${b.days_overdue} يوم)` : ""
        }`,
      ),
    );
  }
  lines.push("");
  lines.push(signature);
  return lines.join("\n");
}

/** Send the daily digest to the owner's Telegram chat (once per day). */
export async function sendDigest(supabase: Client, userId: string): Promise<boolean> {
  const board = await loadBoard(supabase, userId);
  const ch = board.channels;
  if (!ch?.telegram_enabled || !ch.telegram_chat_id) return false;
  if (!board.policy?.daily_digest) return false;
  if (board.counts.all === 0) return false;

  const key = dedupeKey(userId, "digest", "telegram");
  const { data: exists } = await supabase
    .from("outbox")
    .select("id")
    .eq("user_id", userId)
    .eq("dedupe_key", key)
    .maybeSingle();
  if (exists) return false;

  const { data: comp } = await supabase
    .from("company_profile")
    .select("name")
    .eq("user_id", userId)
    .maybeSingle();
  const text = digestText(board, signatureOf(ch, comp?.name ?? null));
  const { data: inserted } = await supabase
    .from("outbox")
    .insert({
      user_id: userId,
      channel: "telegram",
      kind: "digest",
      body: text,
      destination: ch.telegram_chat_id,
      status: "queued",
      dedupe_key: key,
    })
    .select("id")
    .maybeSingle();

  const res = await deliver("telegram", ch.telegram_chat_id, text, {
    whatsappFrom: null,
    smsFrom: null,
  });
  if (inserted?.id) {
    if (res.ok) await markDelivered(supabase, userId, inserted.id, res.ref ?? null);
    else
      await supabase
        .from("outbox")
        .update({ status: "failed", attempts: 1, last_error: res.error ?? null })
        .eq("id", inserted.id);
  }
  return res.ok;
}
