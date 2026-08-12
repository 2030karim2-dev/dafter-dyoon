import { Card } from "@/components/ui/card";

export type BackupFrequency = "off" | "daily" | "weekly" | "monthly";

const FREQS: Array<{ v: BackupFrequency; l: string }> = [
  { v: "off", l: "إيقاف" },
  { v: "daily", l: "يومي" },
  { v: "weekly", l: "أسبوعي" },
  { v: "monthly", l: "شهري" },
];

interface Props {
  value: BackupFrequency;
  onChange: (v: BackupFrequency) => void;
}

export function AutoBackupFrequency({ value, onChange }: Props) {
  return (
    <Card className="p-2.5 space-y-2">
      <div className="font-semibold text-[12px] leading-tight">النسخ التلقائي</div>
      <div className="grid grid-cols-4 gap-1.5">
        {FREQS.map((f) => (
          <button
            key={f.v}
            onClick={() => onChange(f.v)}
            className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${value === f.v ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"}`}
          >
            {f.l}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        يتم النسخ تلقائياً عند فتح التطبيق وفقاً لهذه الفترة.
      </p>
    </Card>
  );
}
