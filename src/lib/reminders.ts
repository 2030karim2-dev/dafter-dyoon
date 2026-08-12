import { supabase } from "@/integrations/supabase/client";

export type RepeatKind = "none" | "daily" | "weekly" | "monthly";

export interface Reminder {
  id: string;
  user_id: string;
  person_id: string | null;
  title: string;
  note: string | null;
  due_date: string;
  is_done: boolean;
  repeat: RepeatKind;
  transaction_id: string | null;
  snoozed_until: string | null;
  created_at: string;
}

/** Advance a date according to a repeat rule. */
export function advanceDate(iso: string, kind: RepeatKind): string {
  const d = new Date(iso);
  switch (kind) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    default:
      return iso;
  }
  return d.toISOString();
}

/** Mark reminder done; if it has a repeat rule, schedule the next occurrence instead. */
export async function completeReminder(r: Pick<Reminder, "id" | "due_date" | "repeat">) {
  if (r.repeat && r.repeat !== "none") {
    const next = advanceDate(r.due_date, r.repeat);
    return supabase
      .from("reminders")
      .update({ due_date: next, snoozed_until: null })
      .eq("id", r.id);
  }
  return supabase.from("reminders").update({ is_done: true }).eq("id", r.id);
}

/** Snooze a reminder by N days (updates due_date + snoozed_until). */
export async function snoozeReminder(id: string, days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const iso = d.toISOString();
  return supabase.from("reminders").update({ due_date: iso, snoozed_until: iso }).eq("id", id);
}

/**
 * Auto-create reminders for unpaid transactions that have a due_date but no reminder yet.
 * Idempotent thanks to the unique partial index on transaction_id.
 */
export async function syncRemindersFromTransactions(userId: string) {
  const { data: txns } = await supabase
    .from("transactions")
    .select("id,person_id,details,amount,due_date,is_paid")
    .eq("user_id", userId)
    .eq("is_paid", false)
    .not("due_date", "is", null);

  if (!txns || txns.length === 0) return 0;

  const ids = txns.map((t) => t.id);
  const { data: existing } = await supabase
    .from("reminders")
    .select("transaction_id")
    .in("transaction_id", ids);
  const have = new Set(
    (existing ?? []).map((e: { transaction_id: string | null }) => e.transaction_id),
  );

  const personIds = Array.from(new Set(txns.map((t) => t.person_id).filter(Boolean)));
  const { data: people } = personIds.length
    ? await supabase
        .from("people")
        .select("id,name")
        .in("id", personIds as string[])
    : { data: [] as { id: string; name: string }[] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.name]));

  const toInsert = txns
    .filter((t) => !have.has(t.id))
    .map((t) => ({
      user_id: userId,
      person_id: t.person_id,
      transaction_id: t.id,
      title: `استحقاق دين${t.person_id ? ` — ${nameOf.get(t.person_id) ?? ""}` : ""}`,
      note: t.details ?? null,
      due_date: t.due_date as string,
      repeat: "none" as const,
    }));

  if (toInsert.length === 0) return 0;
  const { error } = await supabase.from("reminders").insert(toInsert);
  if (error) {
    console.warn("sync reminders error", error.message);
    return 0;
  }
  return toInsert.length;
}
