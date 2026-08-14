/**
 * Pure payment-plan engine (محرك الأقساط) — يعمل على الخادم والمتصفح معاً.
 * يحسب جدول الأقساط من مبلغ وتواريخ: أسبوعي (كل 7 أيام) أو شهري (مع ضبط
 * نهاية الشهر) والمبلغ مقسوم بالتساوي مع وضع الباقي في القسط الأخير.
 */

export interface PlanDraftInput {
  total_amount: number;
  installments_count: number;
  frequency: "weekly" | "monthly";
  start_date: string; // YYYY-MM-DD
}

export interface InstallmentDraft {
  promised_date: string; // YYYY-MM-DD
  amount: number;
}

const p = (n: number) => String(n).padStart(2, "0");

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addMonthClamped(d: Date) {
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
}

/** توليد جدول الأقساط كاملاً. */
export function buildInstallments(input: PlanDraftInput): InstallmentDraft[] {
  const count = Math.max(2, Math.min(24, Math.floor(input.installments_count)));
  const total = Number(input.total_amount);
  if (!(total > 0)) return [];

  const base = Math.round((total / count) * 100) / 100;
  const d = new Date(`${input.start_date}T00:00:00`);
  const out: InstallmentDraft[] = [];

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const amount = isLast ? Math.round((total - base * (count - 1)) * 100) / 100 : base;
    out.push({
      promised_date: toDateStr(d),
      amount: amount > 0 ? amount : base,
    });
    if (input.frequency === "weekly") d.setDate(d.getDate() + 7);
    else addMonthClamped(d);
  }
  return out;
}
