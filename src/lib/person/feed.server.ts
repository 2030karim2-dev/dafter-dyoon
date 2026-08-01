/**
 * Server-only unified customer feed:
 * transactions + sent messages + payment promises + attachments in one stream,
 * scoped to a single currency where a currency applies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient<any, any, any>;

export type FeedKind = "tx" | "message" | "promise" | "attachment";

export interface FeedItem {
  id: string;
  kind: FeedKind;
  at: string;                 // ISO
  title: string;
  subtitle: string | null;
  amount: number | null;
  direction: string | null;   // credit | debit
  currency_id: string | null;
  status: string | null;
  channel: string | null;
}

export async function loadPersonFeed(
  supabase: DB,
  userId: string,
  personId: string,
  currencyId: string | null,
): Promise<FeedItem[]> {
  const [txRes, msgRes, prRes, atRes] = await Promise.all([
    supabase.from("transactions")
      .select("id,amount,direction,currency_id,transaction_date,details,is_paid")
      .eq("user_id", userId).eq("person_id", personId)
      .order("transaction_date", { ascending: false }).limit(200),
    supabase.from("message_log")
      .select("id,channel,kind,body,sent_at,destination")
      .eq("user_id", userId).eq("person_id", personId)
      .order("sent_at", { ascending: false }).limit(100),
    supabase.from("payment_promises")
      .select("id,amount,currency_id,promised_date,status,note,created_at")
      .eq("user_id", userId).eq("person_id", personId)
      .order("promised_date", { ascending: false }).limit(100),
    supabase.from("attachments")
      .select("id,file_name,category,created_at,note,amount")
      .eq("user_id", userId).eq("entity_type", "person").eq("entity_id", personId)
      .order("created_at", { ascending: false }).limit(100),
  ]);

  const items: FeedItem[] = [];

  for (const t of txRes.data ?? []) {
    if (currencyId && t.currency_id !== currencyId) continue;
    items.push({
      id: `tx:${t.id}`,
      kind: "tx",
      at: t.transaction_date,
      title: t.direction === "credit" ? "دين على العميل" : "دفعة / تسوية",
      subtitle: t.details ?? null,
      amount: Number(t.amount),
      direction: t.direction,
      currency_id: t.currency_id,
      status: t.is_paid ? "paid" : "open",
      channel: null,
    });
  }

  const KIND_AR: Record<string, string> = {
    upcoming: "تذكير قبل الاستحقاق",
    due_today: "تذكير استحقاق اليوم",
    overdue: "تذكير بمبلغ متأخر",
    statement: "كشف حساب",
    thanks: "شكر بعد السداد",
  };
  for (const m of msgRes.data ?? []) {
    items.push({
      id: `msg:${m.id}`,
      kind: "message",
      at: m.sent_at,
      title: KIND_AR[m.kind] ?? "رسالة",
      subtitle: (m.body ?? "").split("\n")[0]?.slice(0, 90) ?? null,
      amount: null,
      direction: null,
      currency_id: null,
      status: "sent",
      channel: m.channel,
    });
  }

  for (const p of prRes.data ?? []) {
    if (currencyId && p.currency_id !== currencyId) continue;
    items.push({
      id: `pr:${p.id}`,
      kind: "promise",
      at: new Date(p.promised_date).toISOString(),
      title: "وعد بالسداد",
      subtitle: p.note ?? null,
      amount: Number(p.amount),
      direction: null,
      currency_id: p.currency_id,
      status: p.status,
      channel: null,
    });
  }

  for (const a of atRes.data ?? []) {
    items.push({
      id: `at:${a.id}`,
      kind: "attachment",
      at: a.created_at,
      title: a.file_name,
      subtitle: a.note ?? a.category ?? null,
      amount: a.amount != null ? Number(a.amount) : null,
      direction: null,
      currency_id: null,
      status: a.category ?? null,
      channel: null,
    });
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
