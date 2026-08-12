import { Card } from "@/components/ui/card";
import { Check, Clock, Pencil, Repeat, Trash2 } from "lucide-react";
import { fmtDate } from "@/lib/format";
import type { Reminder, RepeatKind } from "@/lib/reminders";

const REPEAT_LABEL: Record<RepeatKind, string> = {
  none: "لا يتكرر",
  daily: "يومي",
  weekly: "أسبوعي",
  monthly: "شهري",
};

interface Props {
  r: Reminder;
  personName?: string;
  onToggle: () => void;
  onSnooze: (days: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ReminderCard({ r, personName, onToggle, onSnooze, onEdit, onDelete }: Props) {
  const due = new Date(r.due_date);
  const overdue = !r.is_done && due < new Date();
  return (
    <Card
      className={`p-2.5 flex items-start gap-2 ${overdue ? "border-danger/40" : ""} ${r.is_done ? "opacity-60" : ""}`}
    >
      <button
        onClick={onToggle}
        className={`size-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
          r.is_done
            ? "bg-success border-success text-success-foreground"
            : "border-muted-foreground hover:border-primary"
        }`}
        aria-label={r.is_done ? "إلغاء الإكمال" : "إكمال"}
      >
        {r.is_done && <Check className="size-3" />}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className={`font-semibold text-[13px] leading-tight ${r.is_done ? "line-through" : ""}`}
        >
          {r.title}
        </div>
        <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
          {personName && (
            <span className="text-[10px] text-primary font-semibold">{personName}</span>
          )}
          {r.transaction_id && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary">
              دين مرتبط
            </span>
          )}
          {r.repeat !== "none" && (
            <span className="text-[10px] inline-flex items-center gap-0.5 text-muted-foreground">
              <Repeat className="size-2.5" /> {REPEAT_LABEL[r.repeat as RepeatKind]}
            </span>
          )}
        </div>
        {r.note && (
          <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{r.note}</div>
        )}
        <div
          className={`text-[10px] mt-1 ${overdue ? "text-danger font-bold" : "text-muted-foreground"}`}
        >
          {overdue ? "⚠️ متأخر · " : ""}
          {fmtDate(r.due_date)}
        </div>
        {!r.is_done && (
          <div className="flex gap-1 mt-1.5">
            <button
              onClick={() => onSnooze(1)}
              className="text-[10px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-secondary hover:opacity-80"
            >
              <Clock className="size-2.5" /> يوم
            </button>
            <button
              onClick={() => onSnooze(7)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-secondary hover:opacity-80"
            >
              أسبوع
            </button>
            <button
              onClick={onEdit}
              className="text-[10px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-secondary hover:opacity-80 mr-auto"
            >
              <Pencil className="size-2.5" /> تعديل
            </button>
          </div>
        )}
      </div>
      <button
        onClick={onDelete}
        className="text-muted-foreground hover:text-danger p-1"
        aria-label="حذف"
      >
        <Trash2 className="size-3.5" />
      </button>
    </Card>
  );
}

export { REPEAT_LABEL };
