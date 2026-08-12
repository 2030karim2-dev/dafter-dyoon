import { useMemo } from "react";
import { fmtMoney } from "@/lib/format";

interface Tx {
  amount: number;
  direction: string;
  transaction_date: string;
  due_date: string | null;
  is_paid: boolean;
}
interface Props {
  txs: Tx[];
}

export function PersonAnalytics({ txs }: Props) {
  const stats = useMemo(() => {
    const today = new Date();
    let credit = 0,
      debit = 0,
      onTime = 0,
      late = 0,
      overdue = 0;
    const monthly = new Map<string, { credit: number; debit: number }>();
    for (const t of txs) {
      const amt = Number(t.amount) || 0;
      if (t.direction === "credit") credit += amt;
      else debit += amt;
      const d = new Date(t.transaction_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const e = monthly.get(key) ?? { credit: 0, debit: 0 };
      if (t.direction === "credit") e.credit += amt;
      else e.debit += amt;
      monthly.set(key, e);
      if (t.due_date) {
        const due = new Date(t.due_date);
        if (t.is_paid) {
          if (due >= new Date(t.transaction_date)) onTime++;
          else late++;
        } else if (due < today) overdue++;
      }
    }
    const months = Array.from(monthly.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);
    const max = Math.max(1, ...months.map(([, v]) => Math.max(v.credit, v.debit)));
    return { credit, debit, onTime, late, overdue, months, max };
  }, [txs]);

  if (txs.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      <div className="text-xs font-semibold text-muted-foreground">تحليلات سريعة</div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="سدّد بالموعد" value={stats.onTime} tone="emerald" />
        <Stat label="سدّد متأخراً" value={stats.late} tone="amber" />
        <Stat label="متأخر حالياً" value={stats.overdue} tone="red" />
      </div>

      {stats.months.length > 0 && (
        <div>
          <div className="text-[11px] text-muted-foreground mb-1.5">آخر 6 أشهر</div>
          <div className="flex items-end gap-1.5 h-20">
            {stats.months.map(([k, v]) => (
              <div key={k} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex gap-0.5 items-end h-16">
                  <div
                    className="flex-1 bg-emerald-500/70 rounded-sm"
                    style={{ height: `${(v.credit / stats.max) * 100}%` }}
                    title={`له: ${fmtMoney(v.credit)}`}
                  />
                  <div
                    className="flex-1 bg-rose-500/70 rounded-sm"
                    style={{ height: `${(v.debit / stats.max) * 100}%` }}
                    title={`عليه: ${fmtMoney(v.debit)}`}
                  />
                </div>
                <div className="text-[9px] text-muted-foreground">{k.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] pt-1 border-t">
        <span className="text-emerald-600">له إجمالي: {fmtMoney(stats.credit)}</span>
        <span className="text-rose-600">عليه إجمالي: {fmtMoney(stats.debit)}</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "red";
}) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  } as const;
  return (
    <div className={`rounded-lg py-1.5 ${colors[tone]}`}>
      <div className="text-base font-bold leading-tight">{value}</div>
      <div className="text-[10px]">{label}</div>
    </div>
  );
}
