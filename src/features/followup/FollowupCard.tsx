import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/format";
import { Clock, MessageCircle, Phone, Sparkles } from "lucide-react";
import { severityMeta, suggestionsFor, type Bucket } from "@/lib/followup/severity";

interface Props {
  bucket: Bucket;
  onDraft: (b: Bucket) => void;
  onQuickWhatsApp: (b: Bucket) => void;
}

export function FollowupCard({ bucket: b, onDraft, onQuickWhatsApp }: Props) {
  const meta = severityMeta[b.severity];
  const tips = suggestionsFor(b);

  return (
    <div className={`rounded-lg border bg-card shadow-card p-2.5 space-y-2 ring-1 ${meta.ring}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${meta.cls}`}>
            {meta.label}
          </span>
          <Link
            to="/app/person/$id"
            params={{ id: b.person.id }}
            className="font-bold text-foreground hover:text-primary truncate"
          >
            {b.person.name}
          </Link>
        </div>
        <div className="text-left">
          <div className="text-[10px] text-muted-foreground">المستحق</div>
          <div className="font-black tabular-nums text-danger text-sm">
            {fmtMoney(b.net)} <span className="text-[10px]">{b.currency}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
        {b.person.phone && (
          <span className="flex items-center gap-1" dir="ltr">
            <Phone className="size-3" />
            {b.person.phone}
          </span>
        )}
        {b.daysOverdue >= 0 && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {b.daysOverdue === 0 ? "يستحق اليوم" : `متأخر ${b.daysOverdue} يوم`}
          </span>
        )}
        <span>{b.txCount} معاملة</span>
      </div>

      {tips.length > 0 && (
        <ul className="text-[10.5px] space-y-0.5 bg-secondary/40 rounded p-1.5 border border-border/60">
          {tips.map((s, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-primary">•</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px] flex-1"
          onClick={() => onDraft(b)}
        >
          <Sparkles className="size-3" /> رسالة ذكية
        </Button>
        <Button
          size="sm"
          className="h-7 px-2 text-[11px] flex-1 bg-success text-success-foreground hover:bg-success/90"
          onClick={() => onQuickWhatsApp(b)}
        >
          <MessageCircle className="size-3" /> واتساب
        </Button>
      </div>
    </div>
  );
}
