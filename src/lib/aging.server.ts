/**
 * Server-only AR Aging engine (أعمار الديون).
 * يعمّر المستحقات القائمة على العميل (direction = credit) — نفس النموذج
 * المعتمد في لوحة المتابعة وصندوق اليوم، مع خصم التخصيصات المدفوعة فعلاً.
 * الفصل بين العملات صارم: لا خلط ولا تحويل أبداً.
 */

export type AgingBucket = "current" | "late_30" | "late_60" | "late_90" | "late_90plus";

export interface AgingRow {
  transaction_id: string;
  person_id: string;
  person_name: string;
  phone: string | null;
  details: string | null;
  transaction_date: string;
  due_date: string | null;
  amount: number;
  outstanding: number;
  age_days: number;
  bucket: AgingBucket;
}

export interface AgingTotals {
  bucket: AgingBucket;
  label: string;
  total: number;
  count: number;
}

export interface AgingReport {
  rows: AgingRow[];
  totals: AgingTotals[];
  grandTotal: number;
  overdueTotal: number;
  generated_at: string;
}

export const BUCKET_ORDER: AgingBucket[] = [
  "current",
  "late_30",
  "late_60",
  "late_90",
  "late_90plus",
];

export const BUCKET_LABEL: Record<AgingBucket, string> = {
  current: "حديثة (غير متأخرة)",
  late_30: "متأخرة 1-30 يوم",
  late_60: "متأخرة 31-60 يوم",
  late_90: "متأخرة 61-90 يوم",
  late_90plus: "أكثر من 90 يوم",
};

const DAY_MS = 86400000;

function daysSince(iso: string): number {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return Math.floor((Date.now() - d.getTime()) / DAY_MS);
}

export function bucketForAge(age: number): AgingBucket {
  if (age <= 0) return "current";
  if (age <= 30) return "late_30";
  if (age <= 60) return "late_60";
  if (age <= 90) return "late_90";
  return "late_90plus";
}

interface DebtRow {
  id: string;
  person_id: string;
  amount: number | string;
  transaction_date: string;
  due_date: string | null;
  details: string | null;
}

interface PersonLite {
  id: string;
  name: string;
  phone: string | null;
}

interface AllocationRow {
  debt_tx_id: string;
  amount: number | string;
}

/** حساب خالص (نقي) — بدون أي I/O. */
export function computeAging(input: {
  debts: DebtRow[];
  people: PersonLite[];
  allocations: AllocationRow[];
}): AgingReport {
  const peopleMap = new Map(input.people.map((p) => [p.id, p]));
  const allocByTx = new Map<string, number>();
  for (const a of input.allocations) {
    allocByTx.set(a.debt_tx_id, (allocByTx.get(a.debt_tx_id) ?? 0) + Number(a.amount));
  }

  const rows: AgingRow[] = [];
  for (const d of input.debts) {
    const allocated = allocByTx.get(d.id) ?? 0;
    const outstanding = Number(d.amount) - allocated;
    if (outstanding <= 0.0001) continue; // مستحق سُدّد بالكامل
    const person = peopleMap.get(d.person_id);
    const age = daysSince(d.due_date ?? d.transaction_date);
    rows.push({
      transaction_id: d.id,
      person_id: d.person_id,
      person_name: person?.name ?? "—",
      phone: person?.phone ?? null,
      details: d.details,
      transaction_date: d.transaction_date,
      due_date: d.due_date,
      amount: Number(d.amount),
      outstanding,
      age_days: age,
      bucket: bucketForAge(age),
    });
  }

  // الأقدم أولاً (أكبر عمر في الأعلى)
  rows.sort((a, b) => b.age_days - a.age_days);

  const totals: AgingTotals[] = BUCKET_ORDER.map((bucket) => {
    const items = rows.filter((r) => r.bucket === bucket);
    return {
      bucket,
      label: BUCKET_LABEL[bucket],
      total: items.reduce((s, r) => s + r.outstanding, 0),
      count: items.length,
    };
  });

  const grandTotal = rows.reduce((s, r) => s + r.outstanding, 0);
  const overdueTotal = rows
    .filter((r) => r.bucket !== "current")
    .reduce((s, r) => s + r.outstanding, 0);

  return { rows, totals, grandTotal, overdueTotal, generated_at: new Date().toISOString() };
}
