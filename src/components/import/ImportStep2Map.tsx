import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import type { ColumnMapping } from "@/lib/io/importExcel";

const FIELDS = [
  ["name", "الاسم *"],
  ["amount", "المبلغ *"],
  ["direction", "النوع (له/عليه)"],
  ["date", "التاريخ"],
  ["details", "التفاصيل"],
  ["phone", "الجوال"],
  ["currency", "العملة"],
  ["opening_balance", "رصيد افتتاحي"],
] as const;

interface Props {
  headers: string[];
  rowCount: number;
  mapping: ColumnMapping;
  setMapping: React.Dispatch<React.SetStateAction<ColumnMapping>>;
  aiBusy: boolean;
  onAi: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function ImportStep2Map({
  headers,
  rowCount,
  mapping,
  setMapping,
  aiBusy,
  onAi,
  onBack,
  onNext,
}: Props) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground">طابق الأعمدة ({rowCount} صف):</div>
        <Button
          size="sm"
          variant="outline"
          disabled={aiBusy}
          onClick={onAi}
          className="h-7 text-[11px]"
        >
          {aiBusy ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Sparkles className="size-3 text-primary" />
          )}
          اقترح بـ AI
        </Button>
      </div>
      {FIELDS.map(([key, label]) => (
        <div key={key} className="grid grid-cols-3 items-center gap-2">
          <Label className="text-[11px]">{label}</Label>
          <Select
            value={(mapping[key] as string) || "__none"}
            onValueChange={(v) => setMapping((m) => ({ ...m, [key]: v === "__none" ? "" : v }))}
          >
            <SelectTrigger className="col-span-2 h-8 text-[11px]">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">—</SelectItem>
              {headers.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowRight className="size-3.5" /> رجوع
        </Button>
        <Button size="sm" onClick={onNext} className="bg-gradient-primary text-primary-foreground">
          معاينة <ArrowLeft className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
