/**
 * Server-only follow-up domain engine.
 * Computes per-(person, currency) exposure buckets, severity and advice.
 * The frontend never recomputes any of this.
 */

export type Severity = "ok" | "soon" | "due" | "late" | "critical";

export interface PolicyRow {
  user_id: string;
  days_before: number;
  overdue_every_days: number;
  max_reminders: number;
  quiet_start: number;
  quiet_end: number;
  timezone: string;
  auto_send: boolean;
  daily_digest: boolean;
}

export interface ChannelRow {
  user_id: string;
  whatsapp_enabled: boolean;
  whatsapp_auto: boolean;
  whatsapp_from: string | null;
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  telegram_link_code: string | null;
  sms_enabled: boolean;
  sms_from: string | null;
  signature_name: string | null;
}

export interface BoardBucket {
  person_id: string;
  name: string;
  phone: string | null;
  credit_limit: number | null;
  avatar_color: string | null;
  currency_id: string;
  currency_symbol: string;
  currency_name: string;
  net: number;
  days_overdue: number;
  oldest_due: string | null;
  tx_count: number;
  severity: Severity;
  advice: string[];
  last_contact_at: string | null;
  contact_count: number;
  transaction_id: string | null;
  /** True when a reminder was already sent and we are waiting for the next cycle. */
  reminded: boolean;
  next_reminder_at: string | null;
}

export interface BoardCounts {
  all: number;
  critical: number;
  late: number;
  due: number;
  soon: number;
  pending: number;
  reminded: number;
}

export interface BoardTotal {
  currency_id: string;
  symbol: string;
  amount: number;
}

export interface FollowupBoard {
  buckets: BoardBucket[];
  counts: BoardCounts;
  totals: BoardTotal[];
  policy: PolicyRow | null;
  channels: ChannelRow | null;
  generated_at: string;
}

export const DEFAULT_POLICY = {
  days_before: 3,
  overdue_every_days: 7,
  max_reminders: 5,
  quiet_start: 21,
  quiet_end: 8,
  timezone: "Asia/Riyadh",
  auto_send: false,
  daily_digest: true,
};

const ORDER: Record<Severity, number> = { critical: 0, late: 1, due: 2, soon: 3, ok: 4 };

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "حرج",
  late: "متأخر",
  due: "يستحق اليوم",
  soon: "قريباً",
  ok: "ضمن المهلة",
};

export function severityFor(
  days: number,
  amount: number,
  limit: number | null,
  daysBefore: number,
): Severity {
  if (days >= 30 || (limit && amount > limit * 1.2)) return "critical";
  if (days >= 7) return "late";
  if (days >= 1) return "late";
  if (days === 0) return "due";
  if (days >= -daysBefore) return "soon";
  return "ok";
}

export function adviceFor(b: {
  severity: Severity;
  days_overdue: number;
  net: number;
  credit_limit: number | null;
}): string[] {
  const out: string[] = [];
  if (b.severity === "critical") {
    out.push("اتصل مباشرة بالعميل وحدد موعداً نهائياً للسداد.");
    out.push("اقترح تقسيط المبلغ على دفعتين أو ثلاث.");
    out.push("أوقف أي تعامل آجل جديد حتى السداد.");
  } else if (b.severity === "late") {
    out.push("أرسل تذكيراً حازماً ومهذباً الآن.");
    out.push("حدّد موعد سداد جديد ودوّنه كتذكير.");
  } else if (b.severity === "due") {
    out.push("اليوم موعد الاستحقاق — أرسل تذكير اليوم.");
  } else if (b.severity === "soon") {
    out.push("أرسل تذكيراً ودياً قبل موعد الاستحقاق.");
  }
  if (b.credit_limit && b.net > b.credit_limit) {
    out.push("تجاوز الحد الائتماني — يفضّل تقليل التعامل الآجل.");
  }
  return out;
}

interface TxRow {
  id: string;
  person_id: string | null;
  amount: number | string;
  direction: string;
  currency_id: string;
  due_date: string | null;
  is_paid: boolean;
}
interface PersonRow {
  id: string;
  name: string;
  phone: string | null;
  credit_limit: number | null;
  avatar_color: string | null;
}
interface CurRow {
  id: string;
  name: string;
  symbol: string;
}
interface ContactRow {
  person_id: string | null;
  sent_at: string;
}

/** Build the whole board from raw rows. Pure — no IO. */
export function buildBoard(input: {
  txs: TxRow[];
  people: PersonRow[];
  currencies: CurRow[];
  contacts: ContactRow[];
  policy: PolicyRow | null;
  channels: ChannelRow | null;
}): FollowupBoard {
  const daysBefore = input.policy?.days_before ?? DEFAULT_POLICY.days_before;
  const everyDays = Math.max(
    1,
    input.policy?.overdue_every_days ?? DEFAULT_POLICY.overdue_every_days,
  );
  const peopleMap = new Map(input.people.map((p) => [p.id, p]));
  const curMap = new Map(input.currencies.map((c) => [c.id, c]));

  const contactAgg = new Map<string, { last: string; count: number }>();
  for (const c of input.contacts) {
    if (!c.person_id) continue;
    const cur = contactAgg.get(c.person_id);
    if (!cur) contactAgg.set(c.person_id, { last: c.sent_at, count: 1 });
    else {
      cur.count += 1;
      if (c.sent_at > cur.last) cur.last = c.sent_at;
    }
  }

  type Acc = {
    net: number;
    count: number;
    daysOverdue: number;
    oldestDue: string | null;
    txId: string | null;
  };
  const grouped = new Map<string, Acc>();
  const today = Date.now();

  for (const t of input.txs) {
    if (!t.person_id || t.is_paid) continue;
    if (!peopleMap.has(t.person_id)) continue;
    const key = `${t.person_id}|${t.currency_id}`;
    const sign = t.direction === "credit" ? 1 : -1; // credit = customer owes us
    const acc = grouped.get(key) ?? {
      net: 0,
      count: 0,
      daysOverdue: -99999,
      oldestDue: null,
      txId: null,
    };
    acc.net += sign * Number(t.amount);
    acc.count += 1;
    if (t.due_date) {
      const days = Math.floor((today - new Date(t.due_date).getTime()) / 86400000);
      if (days > acc.daysOverdue) {
        acc.daysOverdue = days;
        acc.oldestDue = t.due_date;
        acc.txId = t.id;
      }
    }
    grouped.set(key, acc);
  }

  const buckets: BoardBucket[] = [];
  grouped.forEach((acc, key) => {
    const [personId, currencyId] = key.split("|");
    if (acc.net <= 0) return;
    const p = peopleMap.get(personId!)!;
    const cur = curMap.get(currencyId!);
    const days = acc.daysOverdue === -99999 ? -99999 : acc.daysOverdue;
    const severity = severityFor(days, acc.net, p.credit_limit, daysBefore);
    const contact = contactAgg.get(personId!);
    const bucket: BoardBucket = {
      person_id: p.id,
      name: p.name,
      phone: p.phone,
      credit_limit: p.credit_limit,
      avatar_color: p.avatar_color,
      currency_id: currencyId!,
      currency_symbol: cur?.symbol ?? "",
      currency_name: cur?.name ?? "",
      net: acc.net,
      days_overdue: days === -99999 ? -99999 : days,
      oldest_due: acc.oldestDue,
      tx_count: acc.count,
      severity,
      advice: [],
      last_contact_at: contact?.last ?? null,
      contact_count: contact?.count ?? 0,
      transaction_id: acc.txId,
      reminded: contact
        ? new Date(contact.last).getTime() + everyDays * 86400000 > Date.now()
        : false,
      next_reminder_at: contact
        ? new Date(new Date(contact.last).getTime() + everyDays * 86400000).toISOString()
        : null,
    };
    bucket.advice = adviceFor(bucket);
    buckets.push(bucket);
  });

  // Customers who have not been reminded yet always surface first.
  buckets.sort((a, b) => {
    if (a.reminded !== b.reminded) return a.reminded ? 1 : -1;
    if (ORDER[a.severity] !== ORDER[b.severity]) return ORDER[a.severity] - ORDER[b.severity];
    return b.net - a.net;
  });

  const counts: BoardCounts = {
    all: buckets.length,
    critical: buckets.filter((b) => b.severity === "critical").length,
    late: buckets.filter((b) => b.severity === "late").length,
    due: buckets.filter((b) => b.severity === "due").length,
    soon: buckets.filter((b) => b.severity === "soon").length,
    pending: buckets.filter((b) => !b.reminded).length,
    reminded: buckets.filter((b) => b.reminded).length,
  };

  const totalsMap = new Map<string, number>();
  for (const b of buckets) {
    if (b.severity === "ok") continue;
    totalsMap.set(b.currency_id, (totalsMap.get(b.currency_id) ?? 0) + b.net);
  }
  const totals: BoardTotal[] = [...totalsMap.entries()].map(([cid, amount]) => ({
    currency_id: cid,
    symbol: curMap.get(cid)?.symbol ?? "",
    amount,
  }));

  return {
    buckets,
    counts,
    totals,
    policy: input.policy,
    channels: input.channels,
    generated_at: new Date().toISOString(),
  };
}
