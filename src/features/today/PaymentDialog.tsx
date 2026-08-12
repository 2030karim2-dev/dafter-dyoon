import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { recordPaymentFn } from "@/lib/today.functions";
import { fmtMoney } from "@/lib/format";

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

/** Record a full or partial payment. Allocation to oldest debts happens on the server. */
export function PaymentDialog({
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
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const record = useServerFn(recordPaymentFn);

  const submit = async () => {
    const v = parseFloat(amount);
    if (!v || v <= 0) {
      toast.error("أدخل مبلغ الدفعة");
      return;
    }
    setBusy(true);
    try {
      const res = await record({
        data: {
          person_id: personId,
          currency_id: currencyId,
          amount: v,
          paid_at: new Date(date).toISOString(),
          note: note || null,
        },
      });
      toast.success(
        res.unallocated > 0.005
          ? `تم تسجيل الدفعة — خُصم ${fmtMoney(res.allocated)} من المستحقات وبقي ${fmtMoney(res.unallocated)} رصيداً للعميل`
          : `تم تسجيل الدفعة وتسوية ${res.settled_tx_ids.length} مستحق`,
      );
      onOpenChange(false);
      setAmount("");
      setNote("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تسجيل الدفعة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">تسجيل دفعة — {personName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-[10px] text-muted-foreground bg-secondary rounded-lg p-2">
            تُخصم الدفعة تلقائياً من أقدم المستحقات بعملة{" "}
            <span className="font-bold">{currencyLabel}</span> فقط.
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">المبلغ</Label>
            <Input
              type="number"
              inputMode="decimal"
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">تاريخ الدفعة</Label>
            <Input type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ملاحظة (اختياري)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="نقداً / تحويل بنكي"
            />
          </div>
          <Button
            onClick={submit}
            disabled={busy}
            className="w-full bg-gradient-primary text-primary-foreground"
          >
            حفظ الدفعة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
