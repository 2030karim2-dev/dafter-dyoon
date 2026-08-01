/** Pure follow-up domain logic: severity scoring, grouping and advice. */

export interface FollowupPerson {
  id: string;
  name: string;
  phone: string | null;
  credit_limit: number | null;
}

export interface UnpaidTx {
  id: string;
  person_id: string;
  amount: number;
  direction: string;
  currency_code: string;
  due_date: string | null;
}

export type Severity = "ok" | "soon" | "late" | "critical";

export interface Bucket {
  person: FollowupPerson;
  net: number;
  currency: string;
  daysOverdue: number;
  oldestDue: string | null;
  txCount: number;
  severity: Severity;
}

export function severityFor(days: number, amount: number, limit: number | null): Severity {
  if (days >= 30 || (limit && amount > limit * 1.2)) return "critical";
  if (days >= 7) return "late";
  if (days >= 0) return "soon";
  return "ok";
}

export const severityMeta: Record<Severity, { label: string; cls: string; ring: string }> = {
  ok: { label: "ضمن المهلة", cls: "bg-success-soft text-success", ring: "ring-success/30" },
  soon: {
    label: "قريباً",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    ring: "ring-amber-400/40",
  },
  late: { label: "متأخر", cls: "bg-danger-soft text-danger", ring: "ring-danger/30" },
  critical: { label: "حرج", cls: "bg-danger text-danger-foreground", ring: "ring-danger/50" },
};

const ORDER = { critical: 0, late: 1, soon: 2, ok: 3 } as const;

/** Group unpaid transactions per (person, currency) and score each bucket. */
export function buildBuckets(txs: UnpaidTx[], people: FollowupPerson[]): Bucket[] {
  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const grouped = new Map<
    string,
    {
      person: FollowupPerson;
      net: number;
      currency: string;
      oldestDue: string | null;
      daysOverdue: number;
      count: number;
    }
  >();
  const today = Date.now();

  for (const t of txs) {
    const person = peopleMap.get(t.person_id);
    if (!person) continue;
    const key = `${t.person_id}|${t.currency_code}`;
    const sign = t.direction === "credit" ? 1 : -1; // credit = he owes me
    const entry = grouped.get(key) ?? {
      person,
      net: 0,
      currency: t.currency_code,
      oldestDue: null,
      daysOverdue: -9999,
      count: 0,
    };
    entry.net += sign * Number(t.amount);
    entry.count += 1;
    if (t.due_date) {
      const days = Math.floor((today - new Date(t.due_date).getTime()) / 86400000);
      if (days > entry.daysOverdue) {
        entry.daysOverdue = days;
        entry.oldestDue = t.due_date;
      }
    }
    grouped.set(key, entry);
  }

  const list: Bucket[] = [];
  grouped.forEach((g) => {
    if (g.net <= 0) return; // only debtors (people who owe the user)
    list.push({
      person: g.person,
      net: g.net,
      currency: g.currency,
      daysOverdue: g.daysOverdue,
      oldestDue: g.oldestDue,
      txCount: g.count,
      severity: severityFor(g.daysOverdue, g.net, g.person.credit_limit),
    });
  });

  list.sort((a, b) =>
    ORDER[a.severity] !== ORDER[b.severity]
      ? ORDER[a.severity] - ORDER[b.severity]
      : b.daysOverdue - a.daysOverdue,
  );
  return list;
}

/** Actionable advice for a bucket, based on severity and credit limit. */
export function suggestionsFor(b: Bucket): string[] {
  const out: string[] = [];
  if (b.severity === "critical") {
    out.push("اتصل مباشرة بالعميل وحدد موعداً نهائياً للسداد.");
    out.push("اقترح تقسيط المبلغ على دفعتين أو ثلاث.");
    out.push("ابدأ بإيقاف أي تعاملات جديدة حتى السداد.");
  } else if (b.severity === "late") {
    out.push("أرسل تذكيراً مهذباً عبر الواتساب الآن.");
    out.push("حدّد موعد سداد جديد ودوّنه كتذكير.");
  } else if (b.severity === "soon") {
    out.push("أرسل تذكيراً ودياً قبل موعد الاستحقاق.");
  }
  if (b.person.credit_limit && b.net > b.person.credit_limit) {
    out.push("تجاوز الحد الائتماني — يفضل تقليل التعامل الآجل.");
  }
  return out;
}

/** Total exposure grouped by currency, ignoring safe buckets. */
export function atRiskTotals(buckets: Bucket[]): [string, number][] {
  const map = new Map<string, number>();
  buckets
    .filter((b) => b.severity !== "ok")
    .forEach((b) => map.set(b.currency, (map.get(b.currency) ?? 0) + b.net));
  return [...map.entries()];
}
