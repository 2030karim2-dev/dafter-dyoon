import { supabase } from "@/integrations/supabase/client";

export interface PendingItem {
  id: string;
  kind: "reminder" | "overdue";
  title: string;
  due_date: string;
  person_id?: string | null;
  transaction_id?: string | null;
  amount?: number;
}

/** Fetch unseen reminders + overdue unpaid transactions. */
export async function fetchPending(userId: string): Promise<PendingItem[]> {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const nowIso = today.toISOString();

  const [{ data: reminders }, { data: txns }] = await Promise.all([
    supabase
      .from("reminders")
      .select("id,title,due_date,person_id,transaction_id")
      .eq("user_id", userId)
      .eq("is_done", false)
      .lte("due_date", nowIso)
      .order("due_date"),
    supabase
      .from("transactions")
      .select("id,details,amount,due_date,person_id,people(name)")
      .eq("user_id", userId)
      .eq("is_paid", false)
      .not("due_date", "is", null)
      .lt("due_date", new Date().toISOString())
      .order("due_date"),
  ]);

  const items: PendingItem[] = [];
  const linked = new Set<string>();
  for (const r of reminders ?? []) {
    items.push({
      id: r.id,
      kind: "reminder",
      title: r.title,
      due_date: r.due_date,
      person_id: r.person_id,
      transaction_id: r.transaction_id,
    });
    if (r.transaction_id) linked.add(r.transaction_id);
  }
  for (const t of (txns ?? []) as Array<{
    id: string;
    details: string | null;
    amount: number;
    due_date: string;
    person_id: string;
    people: { name: string } | null;
  }>) {
    if (linked.has(t.id)) continue;
    const personName = t.people?.name ?? "";
    items.push({
      id: `txn:${t.id}`,
      kind: "overdue",
      title: `دين متأخر${personName ? ` — ${personName}` : ""}`,
      due_date: t.due_date,
      person_id: t.person_id,
      transaction_id: t.id,
      amount: Number(t.amount) || 0,
    });
  }
  return items;
}

export async function getLastSeen(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("last_seen_reminder_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.last_seen_reminder_at ?? null;
}

export async function markAllSeen(userId: string) {
  await supabase
    .from("profiles")
    .update({ last_seen_reminder_at: new Date().toISOString() })
    .eq("user_id", userId);
}

export function showLocalNotification(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {
    /* ignore */
  }
}

// Notification preferences are scoped per user so multiple accounts on the
// same device never share settings. Legacy (unscoped) keys are read as a
// fallback once for seamless migration.
export const notifPrefKey = (userId: string, base: string) => `daftarak.notif.${base}.${userId}`;

export function readNotifPref(userId: string, base: string): string | null {
  try {
    return (
      localStorage.getItem(notifPrefKey(userId, base)) ??
      localStorage.getItem(`daftarak.notif.${base}`)
    );
  } catch {
    return null;
  }
}

export function writeNotifPref(userId: string, base: string, value: string) {
  try {
    localStorage.setItem(notifPrefKey(userId, base), value);
  } catch {
    /* ignore */
  }
}

const polledKey = (userId: string) => notifPrefKey(userId, "polledAt");

export async function pollAndNotify(userId: string) {
  const enabled = readNotifPref(userId, "enabled") === "1";
  if (!enabled) return;
  const time = readNotifPref(userId, "time") ?? "09:00";
  const [hh, mm] = time.split(":").map((x) => Number(x) || 0);
  const now = new Date();
  const slot = new Date(now);
  slot.setHours(hh, mm, 0, 0);
  if (now < slot) return;
  const last = Number(localStorage.getItem(polledKey(userId)) ?? 0);
  if (last && last >= slot.getTime()) return;
  const items = await fetchPending(userId);
  if (items.length > 0) showLocalNotification("دفترك", `لديك ${items.length} تنبيهاً مستحقاً`);
  localStorage.setItem(polledKey(userId), String(Date.now()));
}
