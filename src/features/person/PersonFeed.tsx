import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPersonFeedFn, type FeedItem } from "@/lib/person-feed.functions";
import { fmtMoney } from "@/lib/format";
import { Loader2, ArrowDownLeft, ArrowUpRight, MessageCircle, CalendarClock, Paperclip } from "lucide-react";

const META: Record<FeedItem["kind"], { icon: typeof MessageCircle; tone: string }> = {
  tx: { icon: ArrowUpRight, tone: "text-primary bg-primary/10" },
  message: { icon: MessageCircle, tone: "text-info bg-info/10" },
  promise: { icon: CalendarClock, tone: "text-warning bg-warning/10" },
  attachment: { icon: Paperclip, tone: "text-muted-foreground bg-secondary" },
};

const PROMISE_AR: Record<string, string> = {
  open: "قائم", kept: "تم الوفاء", broken: "لم يُوفَ", cancelled: "ملغى",
};

/** One vertical truth: debts, payments, messages, promises and files together. */
export function PersonFeed({ personId, currencyId }: { personId: string; currencyId: string | null }) {
  const getFeed = useServerFn(getPersonFeedFn);
  const { data, isLoading } = useQuery({
    queryKey: ["person-feed", personId, currencyId],
    queryFn: () => getFeed({ data: { person_id: personId, currency_id: currencyId } }),
    staleTime: 20_000,
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="size-4 animate-spin text-primary" /></div>;
  }
  const items = data ?? [];
  if (items.length === 0) {
    return <p className="text-center text-[11px] text-muted-foreground py-6">لا يوجد سجل بعد</p>;
  }

  return (
    <ol className="space-y-1">
      {items.map((it) => {
        const m = META[it.kind];
        const Icon = it.kind === "tx" && it.direction === "debit" ? ArrowDownLeft : m.icon;
        const isCredit = it.kind === "tx" && it.direction === "credit";
        return (
          <li key={it.id} className="flex items-start gap-2 bg-card border rounded-lg p-2">
            <div className={`size-6 rounded-md flex items-center justify-center shrink-0 ${m.tone}`}>
              <Icon className="size-3" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-[11px] truncate">{it.title}</span>
                {it.kind === "promise" && it.status && (
                  <span className="text-[9px] text-muted-foreground">({PROMISE_AR[it.status] ?? it.status})</span>
                )}
                {it.kind === "message" && it.channel && (
                  <span className="text-[9px] text-muted-foreground">({it.channel})</span>
                )}
              </div>
              {it.subtitle && <p className="text-[10px] text-muted-foreground truncate">{it.subtitle}</p>}
              <p className="text-[9px] text-muted-foreground tabular-nums">
                {new Date(it.at).toLocaleDateString("ar-SA")}
              </p>
            </div>
            {it.amount != null && (
              <span className={`font-extrabold text-[12px] tabular-nums shrink-0 ${isCredit ? "text-danger" : it.kind === "tx" ? "text-success" : ""}`}>
                {fmtMoney(it.amount)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
