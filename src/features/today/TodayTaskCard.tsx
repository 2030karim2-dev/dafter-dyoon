import { fmtMoney } from "@/lib/format";
import { Avatar } from "@/components/common/Avatar";
import { Button } from "@/components/ui/button";
import { MessageCircle, HandCoins, CalendarClock, RefreshCw, Send, CheckCheck } from "lucide-react";
import type { TodayTask } from "@/lib/today.functions";

const KIND_STYLE: Record<TodayTask["kind"], { label: string; tone: string }> = {
  promise_broken: { label: "وعد لم يُوفَ", tone: "bg-danger/12 text-danger ring-danger/25" },
  overdue: { label: "متأخر", tone: "bg-danger/12 text-danger ring-danger/25" },
  due_today: { label: "يستحق اليوم", tone: "bg-warning/12 text-warning ring-warning/25" },
  promise_due: { label: "وعد اليوم", tone: "bg-primary/12 text-primary ring-primary/25" },
  failed_message: { label: "رسالة فاشلة", tone: "bg-muted text-muted-foreground ring-border" },
};

const fmtDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ar", { day: "2-digit", month: "2-digit" }) : "—";

interface Props {
  task: TodayTask;
  canAuto: boolean;
  onOpen: () => void;
  onMessage: () => void;
  onAutoSend: () => void;
  onPay: () => void;
  onPromise: () => void;
  onRetry: () => void;
}

/** One actionable row of the daily workspace. Micro density, single-tap actions. */
export function TodayTaskCard({
  task,
  canAuto,
  onOpen,
  onMessage,
  onAutoSend,
  onPay,
  onPromise,
  onRetry,
}: Props) {
  const s = KIND_STYLE[task.kind];
  const isMsg = task.kind === "failed_message";

  return (
    <div
      className={`bg-card border rounded-xl p-2 shadow-card space-y-2 ${
        task.reminded ? "opacity-90 border-s-2 border-s-success" : "border-s-2 border-s-danger"
      }`}
    >
      <div className="flex items-center gap-2">
        <button onClick={onOpen} className="flex items-center gap-2 flex-1 min-w-0 text-right">
          <Avatar name={task.person_name} color={task.avatar_color} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[12px] truncate">{task.person_name}</div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ring-1 ${s.tone}`}>
                {s.label}
              </span>
              {task.reminded ? (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ring-1 bg-success/12 text-success ring-success/25 flex items-center gap-0.5">
                  <CheckCheck className="size-2.5" /> تم التذكير {fmtDay(task.last_contact_at)}
                </span>
              ) : (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ring-1 bg-danger/12 text-danger ring-danger/25">
                  لم يُذكَّر بعد
                </span>
              )}
              {!isMsg && task.days > 0 && (
                <span className="text-[9px] text-muted-foreground tabular-nums">
                  {task.days} يوم تأخير
                </span>
              )}
              {isMsg && task.note && (
                <span className="text-[9px] text-muted-foreground truncate max-w-[140px]">
                  {task.note}
                </span>
              )}
            </div>
            {task.reminded && task.next_reminder_at && (
              <div className="text-[9px] text-muted-foreground mt-0.5">
                التنبيه القادم: {fmtDay(task.next_reminder_at)} · {task.contact_count} تذكير سابق
              </div>
            )}
          </div>
        </button>
        {!isMsg && (
          <div className="text-left shrink-0">
            <div className="font-extrabold text-[13px] tabular-nums">{fmtMoney(task.amount)}</div>
            <div className="text-[9px] text-muted-foreground">
              {task.currency_symbol || task.currency_name}
            </div>
          </div>
        )}
      </div>

      {isMsg ? (
        <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={onRetry}>
          <RefreshCw className="size-3" /> إعادة المحاولة
        </Button>
      ) : (
        <div className="grid grid-cols-4 gap-1">
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={onMessage}>
            <MessageCircle className="size-3" /> يدوي
          </Button>
          <Button
            size="sm"
            className="h-7 text-[10px] bg-success text-success-foreground hover:bg-success/90"
            onClick={onAutoSend}
            disabled={!canAuto}
            title={canAuto ? "إرسال تلقائي فوري" : "الإرسال التلقائي غير مفعّل في الإعدادات"}
          >
            <Send className="size-3" /> تلقائي
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={onPay}>
            <HandCoins className="size-3" /> دفعة
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={onPromise}>
            <CalendarClock className="size-3" /> وعد
          </Button>
        </div>
      )}
    </div>
  );
}
