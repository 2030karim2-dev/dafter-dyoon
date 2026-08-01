import { fmtMoney } from "@/lib/format";
import type { TodayPayload } from "@/lib/today.functions";

/** Per-currency due totals + what was collected today. Currencies never mix. */
export function TodaySummary({ payload }: { payload: TodayPayload }) {
  const { totals, collected_today } = payload;
  if (totals.length === 0 && collected_today.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <div className="rounded-xl border bg-danger/[0.06] ring-1 ring-danger/15 p-2">
        <div className="text-[9px] font-bold text-danger mb-1">مطلوب تحصيله</div>
        <div className="space-y-0.5">
          {totals.length === 0 ? (
            <div className="text-[10px] text-muted-foreground">لا شيء</div>
          ) : (
            totals.map((t) => (
              <div key={t.currency_id} className="flex items-baseline justify-between gap-1">
                <span className="text-[9px] text-muted-foreground truncate">{t.symbol || t.name}</span>
                <span className="font-extrabold text-[12px] tabular-nums text-danger">{fmtMoney(t.amount)}</span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="rounded-xl border bg-success/[0.06] ring-1 ring-success/15 p-2">
        <div className="text-[9px] font-bold text-success mb-1">تم تحصيله اليوم</div>
        <div className="space-y-0.5">
          {collected_today.length === 0 ? (
            <div className="text-[10px] text-muted-foreground">لا شيء بعد</div>
          ) : (
            collected_today.map((t) => (
              <div key={t.currency_id} className="flex items-baseline justify-between gap-1">
                <span className="text-[9px] text-muted-foreground truncate">{t.symbol || t.name}</span>
                <span className="font-extrabold text-[12px] tabular-nums text-success">{fmtMoney(t.amount)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
