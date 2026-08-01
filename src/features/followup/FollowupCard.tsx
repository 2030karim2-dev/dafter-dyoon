import { Avatar } from "@/components/common/Avatar";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/format";
import { MessageCircle, Clock, Phone, History } from "lucide-react";
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
  onSelect: () => void;
  onMessage: () => void;
}

export function FollowupCard({ bucket: b, selected, onSelect, onMessage }: Props) {
  const sev = SEV[b.severity];
  return (
    <div
      className={`rounded-lg border bg-card p-2 space-y-1.5 transition ${selected ? "ring-2 ring-primary border-transparent" : ""}`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="size-3.5 accent-[hsl(var(--primary))]"
          aria-label={`تحديد ${b.name}`}
        />
        <Avatar name={b.name} color={b.avatar_color} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[12px] truncate">{b.name}</span>
            <span className={`text-[9.5px] px-1 py-px rounded font-bold ${sev.cls}`}>
              {sev.label}
            </span>
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
          <div className="text-[9.5px] text-muted-foreground">{b.currency_symbol}</div>
        </div>
      </div>

      {b.advice.length > 0 && (
        <ul className="text-[10px] text-muted-foreground leading-relaxed pr-1 space-y-px">
          {b.advice.slice(0, 2).map((a, i) => (
            <li key={i}>• {a}</li>
          ))}
        </ul>
      )}

      <Button
        size="sm"
        className="w-full h-7 text-[11px] bg-success text-success-foreground hover:bg-success/90"
        onClick={onMessage}
      >
        <MessageCircle className="size-3" /> تجهيز رسالة تذكير
      </Button>
    </div>
  );
}
