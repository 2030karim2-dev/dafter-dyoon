import { fmtMoney } from "@/lib/format";
import { Avatar } from "@/components/common/Avatar";
import { Button } from "@/components/ui/button";
import { MessageCircle, HandCoins, CalendarClock, RefreshCw } from "lucide-react";
import type { TodayTask } from "@/lib/today.functions";

const KIND_STYLE: Record<TodayTask["kind"], { label: string; tone: string }> = {
  promise_broken: { label: "وعد لم يُوفَ", tone: "bg-danger/12 text-danger ring-danger/25" },
  overdue: { label: "متأخر", tone: "bg-danger/12 text-danger ring-danger/25" },
  due_today: { label: "يستحق اليوم", tone: "bg-warning/12 text-warning ring-warning/25" },
  promise_due: { label: "وعد اليوم", tone: "bg-primary/12 text-primary ring-primary/25" },
  failed_message: { label: "رسالة فاشلة", tone: "bg-muted text-muted-foreground ring-border" },
};

interface Props {
  task: TodayTask;
  onOpen: () => void;
  onMessage: () => void;
  onPay: () => void;
  onPromise: () => void;
  onRetry: () => void;
}

/** One actionable row of the daily workspace. Micro density, single-tap actions. */
export function TodayTaskCard({ task, onOpen, onMessage, onPay, onPromise, onRetry }: Props) {
  const s = KIND_STYLE[task.kind];
  const isMsg = task.kind === "failed_message";

  return (
    <div className="bg-card border rounded-xl p-2 shadow-card space-y-2">
      <div className="flex items-center gap-2">
        <button onClick={onOpen} className="flex items-center gap-2 flex-1 min-w-0 text-right">
          <Avatar name={task.person_name} color={task.avatar_color} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[12px] truncate">{task.person_name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ring-1 ${s.tone}`}>{s.label}</span>
              {!isMsg && task.days > 0 && (
                <span className="text-[9px] text-muted-foreground tabular-nums">{task.days} يوم تأخير</span>
              )}
              {isMsg && task.note && (
                <span className="text-[9px] text-muted-foreground truncate max-w-[140px]">{task.note}</span>
              )}
            </div>
          </div>
        </button>
        {!isMsg && (
          <div className="text-left shrink-0">
            <div className="font-extrabold text-[13px] tabular-nums">{fmtMoney(task.amount)}</div>
            <div className="text-[9px] text-muted-foreground">{task.currency_symbol || task.currency_name}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1">
        {isMsg ? (
          <Button size="sm" variant="outline" className="col-span-3 h-7 text-[10px]" onClick={onRetry}>
            <RefreshCw className="size-3" /> إعادة المحاولة
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={onMessage}>
              <MessageCircle className="size-3" /> تذكير
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={onPay}>
              <HandCoins className="size-3" /> دفعة
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={onPromise}>
              <CalendarClock className="size-3" /> وعد
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
