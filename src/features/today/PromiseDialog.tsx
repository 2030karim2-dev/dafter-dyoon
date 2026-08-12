import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createPromiseFn } from "@/lib/today.functions";

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

const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Log a "promise to pay" — the strongest collection signal in debt platforms. */
export function PromiseDialog({
  open,
  onOpenChange,
  personId,
  personName,
  currencyId,
  currencyLabel,
  suggested,
  onDone,
}: Props) {
  const [amount, setAmount] = useState(suggested ? String(suggested) : "");
  const [date, setDate] = useState(() => plusDays(3));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createPromiseFn);

  const submit = async () => {
    const v = parseFloat(amount);
    if (!v || v <= 0) {
      toast.error("أدخل المبلغ الموعود");
      return;
    }
    setBusy(true);
    try {
      await create({
        data: {
          person_id: personId,
          currency_id: currencyId,
          amount: v,
          promised_date: date,
          note: note || null,
        },
      });
      toast.success("تم تسجيل الوعد بالسداد");
      onOpenChange(false);
      setNote("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل حفظ الوعد");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">وعد بالسداد — {personName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-[10px] text-muted-foreground bg-secondary rounded-lg p-2">
            إذا لم يُوفَ الوعد في موعده سيظهر تلقائياً في صندوق اليوم وترتفع خطورة العميل. العملة:{" "}
            <span className="font-bold">{currencyLabel}</span>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">المبلغ الموعود</Label>
            <Input
              type="number"
              inputMode="decimal"
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">تاريخ الوعد</Label>
            <Input type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="flex gap-1 pt-1">
              {[
                { l: "غداً", d: 1 },
                { l: "3 أيام", d: 3 },
                { l: "أسبوع", d: 7 },
              ].map((o) => (
                <button
                  key={o.d}
                  onClick={() => setDate(plusDays(o.d))}
                  className="text-[10px] px-2 py-1 rounded-full bg-secondary hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ملاحظة (اختياري)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="وعد بالسداد بعد تحصيل مستحقاته"
            />
          </div>
          <Button
            onClick={submit}
            disabled={busy}
            className="w-full bg-gradient-primary text-primary-foreground"
          >
            حفظ الوعد
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
