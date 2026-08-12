import { TrendingUp, TrendingDown, Pencil, Trash2, CheckCircle2, Clock } from "lucide-react";
import { fmtMoney, fmtDate, fmtTime } from "@/lib/format";

interface Tx {
  id: string;
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

interface Props {
  tx: Tx;
  currency?: Currency;
  runningBalance: number;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePaid?: () => void;
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

export function TransactionRow({
  tx,
  currency,
  runningBalance,
  onEdit,
  onDelete,
  onTogglePaid,
}: Props) {
  const credit = tx.direction === "credit";
  const state = dueState(tx.due_date, tx.is_paid);
  return (
    <div
      className={`bg-card border rounded-xl p-2 shadow-card animate-in fade-in slide-in-from-bottom-1 ${state === "overdue" ? "border-danger/40" : ""}`}
    >
      <div className="flex items-start gap-2">
        <div
          className={`size-8 rounded-lg flex items-center justify-center shrink-0 ring-1 ${credit ? "bg-success-soft text-success ring-success/25" : "bg-danger-soft text-danger ring-danger/25"} ${tx.is_paid ? "opacity-50" : ""}`}
        >
          {credit ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div
              className={`font-bold tabular-nums text-[13px] leading-tight ${credit ? "text-success" : "text-danger"} ${tx.is_paid ? "line-through opacity-60" : ""}`}
            >
              {credit ? "+" : "-"}
              {fmtMoney(Number(tx.amount))}
              <span className="text-[10px] text-muted-foreground font-normal ms-1">
                {currency?.name}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {fmtDate(tx.transaction_date)} · {fmtTime(tx.transaction_date)}
            </div>
          </div>
          {tx.details && (
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate leading-tight">
              {tx.details}
            </div>
          )}
          {tx.due_date && (
            <div className="mt-1 flex items-center gap-1">
              <span
                className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
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
                {state === "paid" ? "مسدّد" : state === "overdue" ? "متأخر" : "استحقاق"}{" "}
                {fmtDate(tx.due_date)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between mt-1">
            <div className="text-[10px] text-muted-foreground">
              الرصيد: <span className="tabular-nums">{fmtMoney(Math.abs(runningBalance))}</span>{" "}
              {runningBalance >= 0 ? "له" : "عليه"}
            </div>
            <div className="flex gap-0.5 -my-1">
              {tx.due_date && onTogglePaid && (
                <button
                  onClick={onTogglePaid}
                  aria-label="تبديل السداد"
                  className={`p-1 ${tx.is_paid ? "text-success" : "text-muted-foreground hover:text-success"}`}
                >
                  <CheckCircle2 className="size-3" />
                </button>
              )}
              <button
                onClick={onEdit}
                aria-label="تعديل"
                className="text-muted-foreground hover:text-primary p-1"
              >
                <Pencil className="size-3" />
              </button>
              <button
                onClick={onDelete}
                aria-label="حذف"
                className="text-muted-foreground hover:text-danger p-1"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
