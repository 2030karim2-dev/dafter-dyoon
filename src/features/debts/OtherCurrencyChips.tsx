import { Link } from "@tanstack/react-router";

export interface OtherCurrencyBalance {
  currency_id: string;
  name: string;
  symbol: string;
  net: number;
  count: number;
}

/**
 * Shows a customer's balances in the currencies other than the active scope,
 * so the user never has to switch currency paths to know the full picture.
 */
export function OtherCurrencyChips({
  items,
  personId,
  className = "",
}: {
  items: OtherCurrencyBalance[];
  personId?: string;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {items.map((o) => {
        const credit = o.net >= 0;
        const cls = credit
          ? "bg-success-soft text-success ring-success/30"
          : "bg-danger-soft text-danger ring-danger/30";
        const body = (
          <>
            <span className="font-bold opacity-70">{o.symbol || o.name}</span>
            <span className="tabular-nums font-black">
              {credit ? "" : "-"}
              {Math.abs(o.net).toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
          </>
        );
        const shared = `inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ring-1 text-[9px] whitespace-nowrap ${cls}`;
        return personId ? (
          <Link
            key={o.currency_id}
            to="/app/person/$id"
            params={{ id: personId }}
            title={`${o.name}: ${o.count} معاملة`}
            className={shared}
          >
            {body}
          </Link>
        ) : (
          <span key={o.currency_id} title={`${o.name}: ${o.count} معاملة`} className={shared}>
            {body}
          </span>
        );
      })}
    </div>
  );
}
