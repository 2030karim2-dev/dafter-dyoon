import {
  TrendingUp,
  TrendingDown,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  ReceiptText,
} from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/format";

interface Tx {
  id: string;
  person_id?: string;
  amount: number;
  direction: string;
  currency_id: string;
  transaction_date: string;
  details: string | null;
  due_date?: string | null;
  is_paid?: boolean;
}
interface Currency {
  id: string;
  name: string;
}

interface Props<T extends Tx = Tx> {
  txs: T[];
  currencies: Currency[];
  running: Record<string, number>;
  onEdit: (t: T) => void;
  onDelete: (id: string) => void;
  onTogglePaid?: (t: T) => void;
  onReceipt?: (t: T) => void;
}

function dueState(
  due: string | null | undefined,
  is_paid?: boolean,
): "none" | "overdue" | "soon" | "paid" {
  if (is_paid) return "paid";
  if (!due) return "none";
  const d = new Date(due);
  d.setHours(23, 59, 59, 999);
  const ms = d.getTime() - Date.now();
  if (ms < 0) return "overdue";
  if (ms < 3 * 86400000) return "soon";
  return "none";
}

export function TransactionTable<T extends Tx>({
  txs,
  currencies,
  running,
  onEdit,
  onDelete,
  onTogglePaid,
  onReceipt,
}: Props<T>) {
  return (
    <div className="rounded-xl border-2 border-border bg-card shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse" dir="rtl">
          <thead>
            <tr className="bg-gradient-to-l from-primary/15 via-primary/10 to-primary/5 text-foreground">
              <th className="px-1.5 py-2 text-center font-bold border-b-2 border-l border-border w-10">
                #
              </th>
              <th className="px-1.5 py-2 text-center font-bold border-b-2 border-l border-border w-20">
                التاريخ
              </th>
              <th className="px-1.5 py-2 text-center font-bold border-b-2 border-l border-border w-12">
                النوع
              </th>
              <th className="px-1.5 py-2 text-end font-bold border-b-2 border-l border-border">
                المبلغ
              </th>
              <th className="px-1.5 py-2 text-center font-bold border-b-2 border-l border-border w-12">
                العملة
              </th>
              <th className="px-1.5 py-2 text-start font-bold border-b-2 border-l border-border">
                البيان
              </th>
              <th className="px-1.5 py-2 text-end font-bold border-b-2 border-l border-border w-24">
                الرصيد
              </th>
              <th className="px-1.5 py-2 text-center font-bold border-b-2 border-border w-16">
                إجراء
              </th>
            </tr>
          </thead>
          <tbody>
            {txs.map((t, i) => {
              const credit = t.direction === "credit";
              const cur = currencies.find((c) => c.id === t.currency_id);
              const bal = running[t.id] ?? 0;
              const state = dueState(t.due_date, t.is_paid);
              const rowTint =
                state === "overdue"
                  ? "bg-danger-soft/40"
                  : credit
                    ? "bg-success-soft/20"
                    : "bg-danger-soft/15";
              const zebra = i % 2 === 0 ? "" : "bg-muted/30";
              return (
                <tr
                  key={t.id}
                  className={`${zebra} hover:bg-primary/5 transition-colors ${t.is_paid ? "opacity-60" : ""}`}
                >
                  <td
                    className={`px-1.5 py-1.5 text-center border-b border-l border-border tabular-nums text-muted-foreground ${rowTint}`}
                  >
                    {i + 1}
                  </td>
                  <td className="px-1.5 py-1.5 text-center border-b border-l border-border tabular-nums text-[10px]">
                    {fmtDate(t.transaction_date)}
                  </td>
                  <td className="px-1.5 py-1.5 text-center border-b border-l border-border">
                    <span
                      className={`inline-flex items-center justify-center size-5 rounded-md ring-1 ${credit ? "bg-success-soft text-success ring-success/30" : "bg-danger-soft text-danger ring-danger/30"}`}
                    >
                      {credit ? (
                        <TrendingUp className="size-3" />
                      ) : (
                        <TrendingDown className="size-3" />
                      )}
                    </span>
                  </td>
                  <td
                    className={`px-1.5 py-1.5 text-end border-b border-l border-border font-bold tabular-nums ${credit ? "text-success" : "text-danger"} ${t.is_paid ? "line-through" : ""}`}
                  >
                    {credit ? "+" : "-"}
                    {fmtMoney(Number(t.amount))}
                  </td>
                  <td className="px-1.5 py-1.5 text-center border-b border-l border-border text-[10px] text-muted-foreground font-semibold">
                    {cur?.name ?? "—"}
                  </td>
                  <td className="px-1.5 py-1.5 text-start border-b border-l border-border max-w-[140px]">
                    <div className="truncate text-foreground/90">{t.details || "—"}</div>
                    {t.due_date && (
                      <span
                        className={`mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded ${
                          state === "paid"
                            ? "bg-success-soft text-success"
                            : state === "overdue"
                              ? "bg-danger-soft text-danger"
                              : state === "soon"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {state === "paid" ? (
                          <CheckCircle2 className="size-2.5" />
                        ) : (
                          <Clock className="size-2.5" />
                        )}
                        {fmtDate(t.due_date)}
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-1.5 py-1.5 text-end border-b border-l border-border tabular-nums font-semibold ${bal >= 0 ? "text-success" : "text-danger"}`}
                  >
                    {fmtMoney(Math.abs(bal))}
                    <span className="ms-0.5 text-[9px] text-muted-foreground font-normal">
                      {bal >= 0 ? "له" : "عليه"}
                    </span>
                  </td>
                  <td className="px-1 py-1.5 text-center border-b border-border">
                    <div className="inline-flex items-center gap-0.5">
                      {t.due_date && onTogglePaid && (
                        <button
                          onClick={() => onTogglePaid(t)}
                          aria-label="سداد"
                          className={`p-1 rounded hover:bg-success/10 ${t.is_paid ? "text-success" : "text-muted-foreground"}`}
                        >
                          <CheckCircle2 className="size-3" />
                        </button>
                      )}
                      {(!credit || t.is_paid) && onReceipt && (
                        <button
                          onClick={() => onReceipt(t)}
                          aria-label="توليد سند قبض"
                          title="توليد سند قبض لهذه الدفعة"
                          className="p-1 rounded text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        >
                          <ReceiptText className="size-3" />
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(t)}
                        aria-label="تعديل"
                        className="p-1 rounded text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        onClick={() => onDelete(t.id)}
                        aria-label="حذف"
                        className="p-1 rounded text-muted-foreground hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
