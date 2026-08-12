import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import type { MappedTx } from "@/lib/io/importExcel";

interface Props {
  mapped: MappedTx[];
  errors: { row: number; reason: string }[];
  busy: boolean;
  onBack: () => void;
  onCommit: () => void;
}

export function ImportStep3Preview({ mapped, errors, busy, onBack, onCommit }: Props) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-[12px]">
        <CheckCircle2 className="size-4 text-success" /> صالح: <b>{mapped.length}</b>
        {errors.length > 0 && (
          <>
            <AlertTriangle className="size-4 text-danger ms-3" /> أخطاء: <b>{errors.length}</b>
          </>
        )}
      </div>
      <div className="max-h-56 overflow-auto rounded-lg border text-[11px]">
        <table className="w-full">
          <thead className="bg-secondary sticky top-0">
            <tr>
              <th className="p-1.5 text-right">الاسم</th>
              <th className="p-1.5">المبلغ</th>
              <th className="p-1.5">النوع</th>
              <th className="p-1.5">جوال</th>
            </tr>
          </thead>
          <tbody>
            {mapped.slice(0, 50).map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-1.5 text-right">{r.name}</td>
                <td className="p-1.5 text-center tabular-nums">{r.amount}</td>
                <td className="p-1.5 text-center">{r.direction === "credit" ? "له" : "عليه"}</td>
                <td className="p-1.5 text-center" dir="ltr">
                  {r.phone ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mapped.length > 50 && (
        <div className="text-[10px] text-muted-foreground">عرض أول 50 من {mapped.length}</div>
      )}
      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowRight className="size-3.5" /> رجوع
        </Button>
        <Button
          size="sm"
          disabled={busy || !mapped.length}
          onClick={onCommit}
          className="bg-gradient-success text-white"
        >
          {busy ? "جارٍ..." : `استيراد ${mapped.length}`}
        </Button>
      </div>
    </div>
  );
}
