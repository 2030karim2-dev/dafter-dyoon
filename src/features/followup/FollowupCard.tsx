import { Avatar } from "@/components/common/Avatar";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/format";
import { MessageCircle, Clock, Phone, History, Send, CheckCheck } from "lucide-react";
import type { BoardBucket, Severity } from "@/lib/followup.functions";

const SEV: Record<Severity, { label: string; cls: string }> = {
  critical: { label: "حرج", cls: "bg-danger text-danger-foreground" },
  late: { label: "متأخر", cls: "bg-danger-soft text-danger" },
  due: {
    label: "مستحق",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  soon: { label: "قريب", cls: "bg-secondary text-primary" },
  ok: { label: "منتظم", cls: "bg-secondary text-muted-foreground" },
};

interface Props {
  bucket: BoardBucket;
  selected: boolean;
  canAuto: boolean;
  onSelect: () => void;
  onMessage: () => void;
  onAutoSend: () => void;
}

const fmtDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ar", { day: "2-digit", month: "2-digit" }) : "—";

export function FollowupCard({
  bucket: b,
  selected,
  canAuto,
  onSelect,
  onMessage,
  onAutoSend,
}: Props) {
  const sev = SEV[b.severity];
  return (
    <div
      className={`rounded-lg border bg-card p-2 space-y-1.5 transition border-s-2 ${b.reminded ? "border-s-success" : "border-s-danger"} ${selected ? "ring-2 ring-primary border-transparent" : ""}`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="size-3.5 accent-primary"
          aria-label={`تحديد ${b.name}`}
        />
        <Avatar name={b.name} color={b.avatar_color} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[12px] truncate">{b.name}</span>
            <span className={`text-[10.5px] px-1 py-px rounded font-bold ${sev.cls}`}>
              {sev.label}
            </span>
            {b.reminded ? (
              <span className="text-[10.5px] px-1 py-px rounded font-bold bg-success/15 text-success flex items-center gap-0.5">
                <CheckCheck className="size-2.5" /> تم التذكير {fmtDay(b.last_contact_at)}
              </span>
            ) : (
              <span className="text-[10.5px] px-1 py-px rounded font-bold bg-danger/12 text-danger">
                لم يُذكَّر
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {b.days_overdue > 0 && (
              <span className="flex items-center gap-0.5">
                <Clock className="size-2.5" /> متأخر {b.days_overdue} يوم
              </span>
            )}
            {b.contact_count > 0 && (
              <span className="flex items-center gap-0.5">
                <History className="size-2.5" /> {b.contact_count} تذكير
              </span>
            )}
            {b.phone && (
              <span className="flex items-center gap-0.5" dir="ltr">
                <Phone className="size-2.5" /> {b.phone}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-black text-[12.5px] tabular-nums text-danger">
            {fmtMoney(Math.abs(b.net))}
          </div>
          <div className="text-[10.5px] text-muted-foreground">{b.currency_symbol}</div>
        </div>
      </div>

      {b.advice.length > 0 && (
        <ul className="text-[10px] text-muted-foreground leading-relaxed pr-1 space-y-px">
          {b.advice.slice(0, 2).map((a, i) => (
            <li key={i}>• {a}</li>
          ))}
        </ul>
      )}

      {b.reminded && b.next_reminder_at && (
        <div className="text-[10.5px] text-muted-foreground">
          التنبيه القادم: {fmtDay(b.next_reminder_at)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-1">
        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onMessage}>
          <MessageCircle className="size-3" /> تذكير يدوي
        </Button>
        <Button
          size="sm"
          className="h-7 text-[11px] bg-success text-success-foreground hover:bg-success/90"
          onClick={onAutoSend}
          disabled={!canAuto}
          title={canAuto ? "إرسال تلقائي فوري" : "الإرسال التلقائي غير مفعّل في الإعدادات"}
        >
          <Send className="size-3" /> إرسال تلقائي
        </Button>
      </div>
    </div>
  );
}
