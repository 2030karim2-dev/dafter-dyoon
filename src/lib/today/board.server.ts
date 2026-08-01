/**
 * Server-only "Today workspace" engine.
 * Answers one question: what must the user do TODAY?
 * Every amount stays inside its own currency — no mixing, no conversion.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient<any, any, any>;

export type TaskKind = "due_today" | "overdue" | "promise_due" | "promise_broken" | "failed_message";

export interface TodayTask {
  id: string;                 // stable key
  kind: TaskKind;
  person_id: string;
  person_name: string;
  phone: string | null;
  avatar_color: string | null;
  currency_id: string;
  currency_name: string;
  currency_symbol: string;
  amount: number;
  days: number;               // days overdue (0 = today)
  transaction_id: string | null;
  promise_id: string | null;
  outbox_id: string | null;
  note: string | null;
}

export interface TodayCounts {
  all: number;
  due_today: number;
  overdue: number;
  promise_due: number;
  promise_broken: number;
  failed_message: number;
}

export interface TodayPayload {
  tasks: TodayTask[];
  counts: TodayCounts;
  totals: { currency_id: string; name: string; symbol: string; amount: number }[];
  collected_today: { currency_id: string; name: string; symbol: string; amount: number }[];
  generated_at: string;
}

const dayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysBetween = (iso: string) =>
  Math.floor((dayStart().getTime() - new Date(iso).setHours(0, 0, 0, 0)) / 86400000);

interface PersonLite { id: string; name: string; phone: string | null; avatar_color: string | null }
interface CurLite { id: string; name: string; symbol: string }

export async function loadToday(supabase: DB, userId: string): Promise<TodayPayload> {
  const todayIso = dayStart().toISOString().slice(0, 10);

  const [pRes, cRes, tRes, prRes, obRes, payRes] = await Promise.all([
    supabase.from("people").select("id,name,phone,avatar_color")
      .eq("user_id", userId).eq("is_archived", false),
    supabase.from("currencies").select("id,name,symbol").eq("user_id", userId),
    supabase.from("transactions").select("id,person_id,currency_id,amount,direction,due_date,is_paid,details")
      .eq("user_id", userId).eq("direction", "credit").eq("is_paid", false).not("due_date", "is", null),
    supabase.from("payment_promises").select("id,person_id,currency_id,amount,promised_date,status,note")
      .eq("user_id", userId).in("status", ["open", "broken"]),
    supabase.from("outbox").select("id,person_id,channel,status,last_error,body")
      .eq("user_id", userId).eq("status", "failed").limit(50),
    supabase.from("transactions").select("currency_id,amount")
      .eq("user_id", userId).eq("direction", "debit")
      .gte("transaction_date", dayStart().toISOString()),
  ]);

  const people = new Map(((pRes.data ?? []) as PersonLite[]).map((p) => [p.id, p]));
  const curs = new Map(((cRes.data ?? []) as CurLite[]).map((c) => [c.id, c]));

  const base = (personId: string, currencyId: string) => {
    const p = people.get(personId);
    const c = curs.get(currencyId);
    return {
      person_id: personId,
      person_name: p?.name ?? "—",
      phone: p?.phone ?? null,
      avatar_color: p?.avatar_color ?? null,
      currency_id: currencyId,
      currency_name: c?.name ?? "",
      currency_symbol: c?.symbol ?? "",
    };
  };

  const tasks: TodayTask[] = [];

  // 1) transactions due today / overdue — aggregated per person+currency
  type Acc = { amount: number; days: number; txId: string | null };
  const grouped = new Map<string, Acc>();
  for (const t of tRes.data ?? []) {
    if (!t.person_id || !people.has(t.person_id) || !t.due_date) continue;
    const key = `${t.person_id}|${t.currency_id}`;
    const days = daysBetween(t.due_date);
    if (days < 0) continue; // not due yet — handled by the follow-up board
    const acc = grouped.get(key) ?? { amount: 0, days: 0, txId: null };
    acc.amount += Number(t.amount);
    if (days >= acc.days) { acc.days = days; acc.txId = t.id; }
    grouped.set(key, acc);
  }
  grouped.forEach((acc, key) => {
    const [pid, cid] = key.split("|");
    if (!pid || !cid) return;
    tasks.push({
      id: `tx:${key}`,
      kind: acc.days === 0 ? "due_today" : "overdue",
      ...base(pid, cid),
      amount: acc.amount,
      days: acc.days,
      transaction_id: acc.txId,
      promise_id: null,
      outbox_id: null,
      note: null,
    });
  });

  // 2) promises due today / broken
  for (const p of prRes.data ?? []) {
    if (!people.has(p.person_id)) continue;
    const days = daysBetween(p.promised_date);
    const broken = p.status === "broken" || days > 0;
    if (days < 0) continue;
    tasks.push({
      id: `pr:${p.id}`,
      kind: broken ? "promise_broken" : "promise_due",
      ...base(p.person_id, p.currency_id),
      amount: Number(p.amount),
      days,
      transaction_id: null,
      promise_id: p.id,
      outbox_id: null,
      note: p.note ?? null,
    });
  }

  // 3) failed deliveries needing a retry
  for (const o of obRes.data ?? []) {
    if (!o.person_id || !people.has(o.person_id)) continue;
    const p = people.get(o.person_id)!;
    tasks.push({
      id: `ob:${o.id}`,
      kind: "failed_message",
      person_id: p.id,
      person_name: p.name,
      phone: p.phone,
      avatar_color: p.avatar_color,
      currency_id: "",
      currency_name: "",
      currency_symbol: "",
      amount: 0,
      days: 0,
      transaction_id: null,
      promise_id: null,
      outbox_id: o.id,
      note: o.last_error ?? o.channel,
    });
  }

  const ORDER: Record<TaskKind, number> = {
    promise_broken: 0, overdue: 1, due_today: 2, promise_due: 3, failed_message: 4,
  };
  tasks.sort((a, b) =>
    ORDER[a.kind] !== ORDER[b.kind] ? ORDER[a.kind] - ORDER[b.kind] : b.amount - a.amount);

  const counts: TodayCounts = {
    all: tasks.length,
    due_today: tasks.filter((t) => t.kind === "due_today").length,
    overdue: tasks.filter((t) => t.kind === "overdue").length,
    promise_due: tasks.filter((t) => t.kind === "promise_due").length,
    promise_broken: tasks.filter((t) => t.kind === "promise_broken").length,
    failed_message: tasks.filter((t) => t.kind === "failed_message").length,
  };

  const perCur = new Map<string, number>();
  for (const t of tasks) {
    if (!t.currency_id || t.kind === "failed_message") continue;
    if (t.kind === "promise_due" || t.kind === "promise_broken") continue; // avoid double counting
    perCur.set(t.currency_id, (perCur.get(t.currency_id) ?? 0) + t.amount);
  }
  const totals = Array.from(perCur.entries()).map(([cid, amount]) => ({
    currency_id: cid,
    name: curs.get(cid)?.name ?? "",
    symbol: curs.get(cid)?.symbol ?? "",
    amount,
  }));

  const collectedMap = new Map<string, number>();
  for (const r of payRes.data ?? []) {
    collectedMap.set(r.currency_id, (collectedMap.get(r.currency_id) ?? 0) + Number(r.amount));
  }
  const collected_today = Array.from(collectedMap.entries()).map(([cid, amount]) => ({
    currency_id: cid,
    name: curs.get(cid)?.name ?? "",
    symbol: curs.get(cid)?.symbol ?? "",
    amount,
  }));

  return { tasks, counts, totals, collected_today, generated_at: new Date().toISOString() };
}
