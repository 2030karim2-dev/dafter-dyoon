import { fmtMoney } from "@/lib/format";
import type { CurrencyLite } from "@/lib/money/balances";
import { aggregateOwedOwePerCurrency, type MoneyTx } from "@/lib/money/balances";
import { BalanceCard } from "@/components/common/BalanceCard";

interface Props {
  txs: MoneyTx[];
  currencies: CurrencyLite[];
}

/**
 * Global per-currency balance cards. 2-per-row, interactive (tap to expand).
 * Each currency stays strictly separate.
 */
export function MultiCurrencyTotals({ txs, currencies }: Props) {
  const rows = aggregateOwedOwePerCurrency(txs, currencies);
  if (rows.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <div className="text-[10px] font-bold text-muted-foreground tracking-wide">
          الأرصدة حسب العملة
        </div>
        <div className="text-[9px] text-muted-foreground tabular-nums">{rows.length} عملة</div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {rows.map((r) => (
          <BalanceCard
            key={r.currency.id}
            data={{ currency: r.currency, owed: r.owed, owe: r.owe }}
            defaultOpen={r.currency.is_base}
          />
        ))}
      </div>
    </div>
  );
}

export { fmtMoney };
