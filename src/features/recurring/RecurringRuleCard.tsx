import { Card } from "@/components/ui/card";
import { Repeat, Play, Pause, Trash2 } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/format";

export interface Rule {
  id: string;
  kind: string;
  amount: number;
  currency_id: string;
  person_id: string | null;
  direction: string | null;
  frequency: string;
  next_run: string;
  is_active: boolean;
  title: string;
  note: string | null;
}

const FREQ_LABEL: Record<string, string> = {
  daily: "يومي",
  weekly: "أسبوعي",
  monthly: "شهري",
  yearly: "سنوي",
};

interface Props {
  r: Rule;
  currencyName: string;
  onToggle: () => void;
  onDelete: () => void;
}

export function RecurringRuleCard({ r, currencyName, onToggle, onDelete }: Props) {
  return (
    <Card className={`p-3 flex items-center gap-3 ${!r.is_active ? "opacity-60" : ""}`}>
      <div
        className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${r.direction === "credit" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
      >
        <Repeat className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{r.title}</div>
        <div className="text-xs text-muted-foreground">
          {fmtMoney(Number(r.amount))} {currencyName} · {FREQ_LABEL[r.frequency]} · التالي{" "}
          {fmtDate(r.next_run)}
        </div>
      </div>
      <button onClick={onToggle} className="p-2 text-muted-foreground hover:text-primary">
        {r.is_active ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <button onClick={onDelete} className="p-2 text-muted-foreground hover:text-danger">
        <Trash2 className="size-4" />
      </button>
    </Card>
  );
}
