import { Link } from "@tanstack/react-router";
import { fmtMoney, fmtDate } from "@/lib/format";
import type { PersonBalance } from "./PersonRow";
import { RowActions } from "@/components/common/RowActions";
import { OtherCurrencyChips } from "./OtherCurrencyChips";

interface Person {
  id: string;
  name: string;
  phone?: string | null;
}

interface Props {
  rows: { person: Person; balance: PersonBalance }[];
  onEdit?: (p: Person) => void;
  onArchive?: (p: Person) => void;
  onDelete?: (p: Person) => void;
}

/** Professional, colorful, fully grid-lined table view of customers. */
export function PersonTable({ rows, onEdit, onArchive, onDelete }: Props) {
  const hasActions = !!(onEdit || onArchive || onDelete);
  const cols = (hasActions ? 10 : 9) as number;
  return (
    <div className="rounded-xl border-2 border-primary/25 bg-card shadow-card overflow-hidden animate-in fade-in duration-200">
      <div className="overflow-x-auto">
        <table className="w-full text-[10.5px] lg:text-xs border-collapse [&_th]:border [&_td]:border [&_th]:border-primary/25 [&_td]:border-border/70">
          <thead className="bg-gradient-primary text-primary-foreground sticky top-0 z-10">
            <tr className="[&>th]:px-3 lg:[&>th]:px-4 [&>th]:py-2.5 lg:[&>th]:py-3 [&>th]:font-bold [&>th]:text-right [&>th]:whitespace-nowrap">
              <th className="w-8 lg:w-10">#</th>
              <th>العميل</th>
              <th className="hidden sm:table-cell">الهاتف</th>
              <th className="text-center">معاملات</th>
              <th className="text-left">له</th>
              <th className="text-left">عليه</th>
              <th className="text-left">الصافي</th>
              <th className="text-center">عملات أخرى</th>
              <th className="text-center hidden sm:table-cell">آخر دفعة</th>
              {hasActions && <th className="text-center w-12 lg:w-16">إجراء</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ person, balance }, i) => {
              const isCredit = balance.net >= 0;
              const settled = Math.abs(balance.net) < 0.001;
              const zebra = i % 2 === 0 ? "bg-card" : "bg-secondary/40";
              const stateTint = settled
                ? ""
                : isCredit
                  ? "border-r-2 border-r-success"
                  : "border-r-2 border-r-danger";
              return (
                <tr
                  key={person.id}
                  className={`${zebra} ${stateTint} hover:bg-primary/5 transition-colors`}
                >
                  <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-3 lg:px-4 py-2.5 lg:py-3">
                    <Link
                      to="/app/person/$id"
                      params={{ id: person.id }}
                      className="font-bold text-foreground hover:text-primary truncate block max-w-[140px] lg:max-w-none"
                    >
                      {person.name}
                    </Link>
                  </td>
                  <td
                    className="px-3 lg:px-4 py-2.5 lg:py-3 hidden sm:table-cell text-muted-foreground tabular-nums"
                    dir="ltr"
                  >
                    {person.phone || "—"}
                  </td>
                  <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-center tabular-nums text-muted-foreground">
                    {balance.count}
                  </td>
                  <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-left tabular-nums font-semibold text-success">
                    {(balance.totalCredit ?? 0) > 0 ? fmtMoney(balance.totalCredit ?? 0) : "—"}
                  </td>
                  <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-left tabular-nums font-semibold text-danger">
                    {(balance.totalDebit ?? 0) > 0 ? fmtMoney(balance.totalDebit ?? 0) : "—"}
                  </td>
                  <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-left">
                    {settled ? (
                      <span className="inline-block px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground text-[9px] font-bold">
                        مسوّى
                      </span>
                    ) : (
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums ${
                          isCredit
                            ? "bg-success-soft text-success ring-1 ring-success/30"
                            : "bg-danger-soft text-danger ring-1 ring-danger/30"
                        }`}
                      >
                        {isCredit ? "" : "-"}
                        {fmtMoney(Math.abs(balance.net))}
                        {balance.symbol ? (
                          <span className="text-[8.5px] font-bold opacity-75">
                            {" "}
                            {balance.symbol}
                          </span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className="px-3 lg:px-4 py-2.5 lg:py-3">
                    {balance.others && balance.others.length > 0 ? (
                      <OtherCurrencyChips items={balance.others} />
                    ) : (
                      <span className="text-muted-foreground text-[9px]">—</span>
                    )}
                  </td>
                  <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-center hidden sm:table-cell text-muted-foreground tabular-nums">
                    {balance.lastDate ? fmtDate(new Date(balance.lastDate).toISOString()) : "—"}
                  </td>
                  {hasActions && (
                    <td className="px-2 lg:px-4 py-2.5 lg:py-3 text-center">
                      <RowActions
                        onEdit={onEdit ? () => onEdit(person) : undefined}
                        onArchive={onArchive ? () => onArchive(person) : undefined}
                        onDelete={onDelete ? () => onDelete(person) : undefined}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols} className="text-center py-4 text-muted-foreground text-[10px]">
                  لا توجد بيانات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
