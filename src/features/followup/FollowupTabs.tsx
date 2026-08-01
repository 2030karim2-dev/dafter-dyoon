import type { FollowupTab } from "./useBoard";

const META: Record<FollowupTab, { label: string; cls: string }> = {
  pending: { label: "بحاجة تذكير", cls: "bg-danger text-danger-foreground" },
  reminded: { label: "تم تذكيرهم", cls: "bg-success text-success-foreground" },
  all: { label: "الكل", cls: "bg-primary text-primary-foreground" },
  critical: { label: "حرج", cls: "bg-danger text-danger-foreground" },
  late: { label: "متأخر", cls: "bg-danger-soft text-danger" },
  due: {
    label: "مستحق",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  soon: { label: "قريب", cls: "bg-secondary text-primary" },
};

const ORDER: FollowupTab[] = ["pending", "reminded", "all", "critical", "late", "due", "soon"];

interface Props {
  tab: FollowupTab;
  counts: Record<FollowupTab, number>;
  onChange: (t: FollowupTab) => void;
}

export function FollowupTabs({ tab, counts, onChange }: Props) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {ORDER.map((t) => {
        const active = tab === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`rounded-lg p-1.5 border text-[10.5px] font-bold flex flex-col items-center gap-0.5 transition ${active ? META[t].cls + " border-transparent shadow-card" : "bg-card border-border text-foreground hover:bg-secondary"}`}
          >
            <span>{META[t].label}</span>
            <span className="text-[10px] opacity-80 tabular-nums">{counts[t]}</span>
          </button>
        );
      })}
    </div>
  );
}
