import { Link } from "@tanstack/react-router";
import { Phone, Clock } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/format";
import { RowActions } from "@/components/common/RowActions";
import { OtherCurrencyChips, type OtherCurrencyBalance } from "./OtherCurrencyChips";

interface Person {
  id: string;
  name: string;
  phone?: string | null;
}
export interface PersonBalance {
  net: number;
  count: number;
  lastDate: number;
  lastAmount?: number;
  lastDirection?: string;
  totalCredit?: number;
  totalDebit?: number;
  symbol?: string;
  /** Balances in the non-active currencies (kept visible to avoid switching). */
  others?: OtherCurrencyBalance[];
}

interface Props {
  person: Person;
  balance: PersonBalance;
  index?: number;
  onEdit?: (p: Person) => void;
  onArchive?: (p: Person) => void;
  onDelete?: (p: Person) => void;
}

/** Rich micro-card for a person — phone, last payment, totals. */
export function PersonRow({ person, balance, index = 0, onEdit, onArchive, onDelete }: Props) {
  const isCredit = balance.net >= 0;
  const settled = Math.abs(balance.net) < 0.001;
  const hasLast = !!balance.lastDate;
  const hasActions = !!(onEdit || onArchive || onDelete);
  return (
    <Link
      to="/app/person/$id"
      params={{ id: person.id }}
      className="block bg-card rounded-lg border shadow-card hover:shadow-elevated hover:border-primary/20 transition-all p-3 lg:p-4 active:scale-[0.99] animate-in fade-in slide-in-from-bottom-1"
      style={{ animationDelay: `${Math.min(index * 25, 250)}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-center gap-3">
        <div
          className={`size-10 lg:size-11 rounded-md flex items-center justify-center font-bold text-sm lg:text-base ring-1 shrink-0 ${
            settled
              ? "bg-secondary text-muted-foreground ring-border"
              : isCredit
                ? "bg-success-soft text-success ring-success/30"
                : "bg-danger-soft text-danger ring-danger/30"
          }`}
        >
          {person.name.trim().charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[12.5px] lg:text-sm truncate leading-tight">
            {person.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] lg:text-xs text-muted-foreground">
            {person.phone ? (
              <span className="inline-flex items-center gap-0.5" dir="ltr">
                <Phone className="size-2.5 lg:size-3" />
                {person.phone}
              </span>
            ) : (
              <span>{balance.count} معاملة</span>
            )}
            {person.phone && <span className="hidden sm:inline">· {balance.count} معاملة</span>}
          </div>
        </div>
        <div className="text-left shrink-0">
          {settled ? (
            <div className="text-[10.5px] lg:text-xs text-muted-foreground font-semibold uppercase">
              مسوّى
            </div>
          ) : (
            <>
              <div
                className={`font-black text-[13px] lg:text-base tabular-nums leading-tight ${isCredit ? "text-success" : "text-danger"}`}
              >
                {isCredit ? "" : "-"}
                {fmtMoney(Math.abs(balance.net))}
                {balance.symbol ? (
                  <span className="text-[9px] lg:text-[10px] font-bold opacity-75">
                    {" "}
                    {balance.symbol}
                  </span>
                ) : null}
              </div>
              <div className="text-[8.5px] lg:text-[10px] text-muted-foreground font-semibold uppercase mt-0.5">
                {isCredit ? "له" : "عليه"}
              </div>
            </>
          )}
        </div>
        {hasActions && (
          <div className="shrink-0">
            <RowActions
              onEdit={onEdit ? () => onEdit(person) : undefined}
              onArchive={onArchive ? () => onArchive(person) : undefined}
              onDelete={onDelete ? () => onDelete(person) : undefined}
            />
          </div>
        )}
      </div>

      {hasLast && (
        <div className="mt-2 pt-2 border-t border-dashed flex items-center justify-between text-[10.5px] lg:text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-3 lg:size-3.5" />
            <span>تاريخ آخر معاملة</span>
          </div>
          <span className="tabular-nums font-semibold text-foreground/80">
            {fmtDate(new Date(balance.lastDate).toISOString())}
          </span>
        </div>
      )}

      {balance.others && balance.others.length > 0 && (
        <div className="mt-2 pt-2 border-t border-dashed flex items-center gap-1.5">
          <span className="text-[8.5px] lg:text-[10px] font-bold text-muted-foreground shrink-0">
            عملات أخرى
          </span>
          <OtherCurrencyChips items={balance.others} />
        </div>
      )}
    </Link>
  );
}
