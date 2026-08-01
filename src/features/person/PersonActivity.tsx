import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText,
  History,
  Loader2,
  MessageCircle,
  Paperclip,
  HandCoins,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import { getPersonActivityFn, type ActivityItem } from "@/lib/person-activity.functions";
import { EmptyState } from "@/components/EmptyState";

const ICONS = {
  audit: FileText,
  message: MessageCircle,
  outbox: AlertTriangle,
  promise: HandCoins,
  attachment: Paperclip,
  tx: Wallet,
} as const;

const TONE = {
  neutral: "bg-secondary text-foreground/70 ring-border",
  success: "bg-success-soft text-success ring-success/30",
  danger: "bg-danger-soft text-danger ring-danger/30",
  warning: "bg-amber-100 text-amber-700 ring-amber-300/60 dark:bg-amber-900/40 dark:text-amber-300",
} as const;

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ar", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Chronological activity log for a single customer. */
export function PersonActivity({ personId }: { personId: string }) {
  const load = useServerFn(getPersonActivityFn);
  const { data, isLoading } = useQuery({
    queryKey: ["person-activity", personId],
    queryFn: () => load({ data: { person_id: personId } }) as Promise<ActivityItem[]>,
    staleTime: 20_000,
  });
  const items = data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="لا يوجد نشاط بعد"
        description="ستظهر هنا كل الإجراءات: المعاملات، الرسائل، الوعود، والمرفقات."
        variant="compact"
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden divide-y divide-border/70">
      {items.map((it) => {
        const Icon = ICONS[it.kind] ?? FileText;
        return (
          <div key={it.id} className="flex items-start gap-2 p-2">
            <span
              className={`size-6 shrink-0 rounded-md ring-1 flex items-center justify-center ${TONE[it.tone]}`}
            >
              <Icon className="size-3" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] font-bold truncate">{it.title}</span>
                {it.meta && (
                  <span className="text-[9px] font-bold px-1 py-px rounded bg-secondary text-muted-foreground tabular-nums shrink-0">
                    {it.meta}
                  </span>
                )}
              </div>
              {it.detail && (
                <div className="text-[10px] text-muted-foreground truncate">{it.detail}</div>
              )}
            </div>
            <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
              {fmt(it.at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
