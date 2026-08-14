import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createPlanFn } from "@/lib/plans.functions";
import { buildInstallments } from "@/lib/plans";
import { fmtMoney, fmtDate } from "@/lib/format";
import { CalendarRange, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personId: string;
  personName: string;
  currencyId: string;
  currencyLabel: string;
  suggested?: number;
  onDone: () => void;
}

/** جدولة دين إلى خطة أقساط تُتابع تلقائياً في صندوق اليوم. */
export function PlanDialog({
  open,
  onOpenChange,
  personId,
  personName,
  currencyId,
  currencyLabel,
  suggested,
  onDone,
}: Props) {
  const [total, setTotal] = useState(suggested ? String(Math.abs(suggested)) : "");
  const [count, setCount] = useState("5");
  const [freq, setFreq] = useState<"weekly" | "monthly">("monthly");
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createPlanFn);

  const preview = useMemo(() => {
    const v = parseFloat(total);
    if (!v || v <= 0) return [];
    const c = Math.max(2, Math.min(24, parseInt(count, 10) || 2));
    return buildInstallments({
      total_amount: v,
      installments_count: c,
      frequency: freq,
      start_date: start,
    });
  }, [total, count, freq, start]);

  const submit = async () => {
    const v = parseFloat(total);
    const c = parseInt(count, 10);
    if (!v || v <= 0) {
      toast.error("أدخل مبلغ الدين");
      return;
    }
    if (!c || c < 2 || c > 24) {
      toast.error("عدد الأقساط بين 2 و 24");
      return;
    }
    setBusy(true);
    try {
      await create({
        data: {
          person_id: personId,
          currency_id: currencyId,
          total_amount: v,
          installments_count: c,
          frequency: freq,
          start_date: start,
          note: note.trim() || null,
        },
      });
      toast.success(`تم إنشاء الخطة — ${preview.length} قسطاً`);
      onOpenChange(false);
      setTotal("");
      setCount("5");
      setNote("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل إنشاء الخطة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">جدولة الدين — {personName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-[10px] text-muted-foreground bg-secondary rounded-lg p-2">
            تُقسَّم قيمة الدين على أقساط شهرية أو أسبوعية، ويتابع النظام كل قسط تلقائياً في صندوق
            اليوم. العملة: <span className="font-bold">{currencyLabel}</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">إجمالي الدين</Label>
            <Input
              type="number"
              inputMode="decimal"
              dir="ltr"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">عدد الأقساط</Label>
            <div className="flex gap-1">
              {["3", "5", "10"].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`flex-1 h-8 rounded-lg text-xs font-bold ring-1 transition-colors ${
                    count === n
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-secondary text-muted-foreground ring-border hover:bg-primary/10"
                  }`}
                >
                  {n}
                </button>
              ))}
              <Input
                type="number"
                min={2}
                max={24}
                dir="ltr"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-20 h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">الدورية</Label>
              <div className="grid grid-cols-2 gap-1">
                {(
                  [
                    { v: "monthly", l: "شهري" },
                    { v: "weekly", l: "أسبوعي" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setFreq(o.v)}
                    className={`h-8 rounded-lg text-[11px] font-bold ring-1 transition-colors ${
                      freq === o.v
                        ? "bg-primary text-primary-foreground ring-primary"
                        : "bg-secondary text-muted-foreground ring-border"
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">تاريخ أول قسط</Label>
              <Input
                type="date"
                dir="ltr"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">ملاحظة (اختياري)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: تقسيط فاتورة بضاعة"
            />
          </div>

          {preview.length > 0 && (
            <div className="rounded-lg border border-border bg-secondary/40 p-2">
              <div className="text-[10px] font-bold text-muted-foreground mb-1.5">
                معاينة الجدول — {preview.length} قسطاً
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {preview.map((ins, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[10.5px] bg-card rounded px-1.5 py-1"
                  >
                    <span className="tabular-nums text-muted-foreground">
                      {i + 1}. {fmtDate(ins.promised_date)}
                    </span>
                    <span className="font-bold tabular-nums">
                      {fmtMoney(ins.amount)} {currencyLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={submit}
            disabled={busy || preview.length === 0}
            className="w-full bg-gradient-primary text-primary-foreground"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarRange className="size-4" />
            )}
            إنشاء الخطة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
