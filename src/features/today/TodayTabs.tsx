import type { TodayCounts } from "@/lib/today.functions";

export type TodayTab = "all" | "overdue" | "due_today" | "promise_due" | "promise_broken" | "failed_message";

const TABS: { key: TodayTab; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "overdue", label: "متأخر" },
  { key: "due_today", label: "اليوم" },
  { key: "promise_due", label: "وعود" },
  { key: "promise_broken", label: "وعود مخلَفة" },
  { key: "failed_message", label: "رسائل فاشلة" },
];

export function TodayTabs({
  tab, counts, onChange,
}: { tab: TodayTab; counts: TodayCounts; onChange: (t: TodayTab) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
      {TABS.map((t) => {
        const n = counts[t.key];
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`shrink-0 px-2.5 h-7 rounded-full text-[10px] font-bold transition-colors ring-1 ${
              active
                ? "bg-gradient-primary text-primary-foreground ring-transparent shadow-glow"
                : "bg-card text-muted-foreground ring-border hover:text-foreground"
            }`}
          >
            {t.label}
            {n > 0 && <span className="ms-1 tabular-nums opacity-80">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
