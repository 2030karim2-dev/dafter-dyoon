import { Coins } from "lucide-react";

export interface ScopeCurrency {
  id: string;
  name: string;
  symbol: string;
  is_base: boolean;
}

interface Props {
  currencies: ScopeCurrency[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * Currency scope switcher. Every currency is a completely separate ledger,
 * so the whole screen follows the selected currency only.
 */
export function CurrencyScope({ currencies, value, onChange, className = "" }: Props) {
  if (currencies.length === 0) return null;
  return (
    <div
      className={`flex items-center gap-1 rounded-xl bg-secondary/60 p-1 ring-1 ring-border ${className}`}
    >
      <span className="inline-flex items-center gap-1 px-1.5 text-[10.5px] font-bold text-muted-foreground shrink-0">
        <Coins className="size-3" /> المسار
      </span>
      <div
        className="flex-1 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${currencies.length}, minmax(0,1fr))` }}
      >
        {currencies.map((c) => {
          const active = c.id === value;
          return (
            <button
              key={c.id}
              onClick={() => onChange(c.id)}
              aria-pressed={active}
              className={`rounded-lg px-2 py-1.5 text-[11px] font-bold transition truncate ${
                active
                  ? "bg-card text-primary shadow-sm ring-1 ring-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.name} <span className="text-[9px] opacity-70">{c.symbol}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
