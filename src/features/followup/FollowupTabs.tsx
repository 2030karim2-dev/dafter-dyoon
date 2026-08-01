import type { FollowupTab } from "./useFollowup";

const META: Record<FollowupTab, { label: string; cls: string }> = {
  all: { label: "الكل", cls: "bg-primary text-primary-foreground" },
  critical: { label: "حرج", cls: "bg-danger text-danger-foreground" },
  late: { label: "متأخر", cls: "bg-danger-soft text-danger" },
  soon: {
    label: "قريب",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
};

interface Props {
  tab: FollowupTab;
  counts: Record<FollowupTab, number>;
  onChange: (t: FollowupTab) => void;
}

export function FollowupTabs({ tab, counts, onChange }: Props) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {(["all", "critical", "late", "soon"] as const).map((t) => {
        const active = tab === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`rounded-lg p-1.5 border text-[11px] font-bold flex flex-col items-center gap-0.5 transition ${active ? META[t].cls + " border-transparent shadow-card" : "bg-card border-border text-foreground hover:bg-secondary"}`}
          >
            <span>{META[t].label}</span>
            <span className="text-[10px] opacity-80 tabular-nums">{counts[t]}</span>
          </button>
        );
      })}
    </div>
  );
}
