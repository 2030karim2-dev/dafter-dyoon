import { useState } from "react";
import { TrendingUp, TrendingDown, ChevronDown, Wallet } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import type { CurrencyLite } from "@/lib/money/balances";

export interface BalanceCardData {
  currency: CurrencyLite;
  owed: number; // له (credit)
  owe: number; // عليه (debit)
  opening?: number; // signed opening
  txCount?: number;
}

interface Props {
  data: BalanceCardData;
  /** Default expanded state */
  defaultOpen?: boolean;
}

/**
 * Unified compact balance card.
 * - 2-per-row on mobile (parent uses grid-cols-2).
 * - Tap to expand details (owed / owe / opening / count).
 * - Color tinted by net direction (success/danger/neutral).
 */
export function BalanceCard({ data, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const net = data.owed - data.owe;
  const isCredit = net > 0;
  const isDebit = net < 0;

  const tone = isCredit
    ? "from-success/15 to-success/5 border-success/30"
    : isDebit
      ? "from-danger/15 to-danger/5 border-danger/30"
      : "from-muted to-card border-border";

  const netColor = isCredit ? "text-success" : isDebit ? "text-danger" : "text-foreground";
  const tag = isCredit ? "له" : isDebit ? "عليه" : "متوازن";
  const tagBg = isCredit
    ? "bg-success/20 text-success"
    : isDebit
      ? "bg-danger/20 text-danger"
      : "bg-muted text-muted-foreground";

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={`w-full text-right rounded-xl border bg-gradient-to-br ${tone} shadow-sm hover:shadow-md active:scale-[0.98] transition-all overflow-hidden`}
    >
      {/* Header */}
      <div className="px-2 py-1.5 flex items-center justify-between border-b border-border/40 bg-background/40">
        <div className="flex items-center gap-1 min-w-0">
          <Wallet className="size-3 text-muted-foreground shrink-0" />
          <span className="text-[10.5px] font-bold truncate">{data.currency.name}</span>
          {data.currency.is_base && (
            <span className="text-[8px] px-1 rounded-full bg-primary/15 text-primary font-bold">
              أساس
            </span>
          )}
        </div>
        <ChevronDown
          className={`size-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {/* Net */}
      <div className="px-2 py-1.5">
        <div className="flex items-baseline justify-between gap-1">
          <span className={`text-[8.5px] px-1 rounded ${tagBg} font-bold`}>{tag}</span>
          <div className={`text-[15px] font-black tabular-nums ${netColor} truncate`}>
            {fmtMoney(Math.abs(net))}
            <span className="text-[9px] mr-0.5 opacity-80">{data.currency.symbol}</span>
          </div>
        </div>
      </div>

      {/* Summary chips (always visible) */}
      <div className="px-1.5 pb-1.5 grid grid-cols-2 gap-1">
        <div className="rounded-md bg-success/10 px-1.5 py-1">
          <div className="flex items-center gap-0.5 text-success text-[8.5px] font-bold leading-none">
            <TrendingUp className="size-2.5" /> له
          </div>
          <div className="text-success text-[10.5px] font-black tabular-nums leading-tight mt-0.5 truncate">
            {fmtMoney(data.owed)}
          </div>
        </div>
        <div className="rounded-md bg-danger/10 px-1.5 py-1">
          <div className="flex items-center gap-0.5 text-danger text-[8.5px] font-bold leading-none">
            <TrendingDown className="size-2.5" /> عليه
          </div>
          <div className="text-danger text-[10.5px] font-black tabular-nums leading-tight mt-0.5 truncate">
            {fmtMoney(data.owe)}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {open && (
        <div className="px-2 pb-2 pt-1 border-t border-border/40 bg-background/30 space-y-0.5 text-[10.5px]">
          {data.txCount !== undefined && <Row label="عدد المعاملات" value={`${data.txCount}`} />}
          {data.opening !== undefined && data.opening !== 0 && (
            <Row
              label="رصيد افتتاحي"
              value={`${fmtMoney(Math.abs(data.opening))} ${data.currency.symbol}`}
              tone={data.opening > 0 ? "success" : "danger"}
            />
          )}
        </div>
      )}
    </button>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  const c =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold tabular-nums ${c}`}>{value}</span>
    </div>
  );
}
