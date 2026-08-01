import { AlertTriangle } from "lucide-react";
import { fmtMoney } from "@/lib/format";

export function AtRiskBanner({ totals }: { totals: [string, number][] }) {
  if (totals.length === 0) return null;
  return (
    <div className="rounded-lg border border-danger/30 bg-danger-soft/40 p-2.5 flex items-start gap-2">
      <AlertTriangle className="size-4 text-danger shrink-0 mt-0.5" />
      <div className="text-[11px] leading-relaxed">
        <div className="font-bold text-danger mb-0.5">إجمالي المبالغ المعرضة للخطر:</div>
        <div className="flex flex-wrap gap-1.5">
          {totals.map(([cur, amt]) => (
            <span
              key={cur}
              className="bg-card border rounded px-1.5 py-0.5 font-black tabular-nums text-danger"
            >
              {fmtMoney(amt)} {cur}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
