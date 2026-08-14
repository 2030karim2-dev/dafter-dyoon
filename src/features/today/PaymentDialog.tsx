import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { recordPaymentFn } from "@/lib/today.functions";
import { createReceiptVoucherFn } from "@/lib/receipts.functions";
import { exportReceiptPDF } from "@/lib/io/exportPdf";
import { fmtMoney } from "@/lib/format";
import { CheckCircle2, ReceiptText, Loader2 } from "lucide-react";

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

interface LastPayment {
  paymentTxId: string;
  amount: number;
  allocated: number;
  unallocated: number;
  settledCount: number;
}

/**
 * Record a full or partial payment (allocated FIFO to the oldest debts on the
 * server), then offer to generate a professional receipt voucher (سند قبض).
 */
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
  const [last, setLast] = useState<LastPayment | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const record = useServerFn(recordPaymentFn);
  const createReceipt = useServerFn(createReceiptVoucherFn);

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
      setLast({
        paymentTxId: res.payment_tx_id,
        amount: v,
        allocated: res.allocated,
        unallocated: res.unallocated,
        settledCount: res.settled_tx_ids.length,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تسجيل الدفعة");
    } finally {
      setBusy(false);
    }
  };

  const genReceipt = async () => {
    if (!last) return;
    setReceiptBusy(true);
    try {
      const r = await createReceipt({
        data: {
          person_id: personId,
          payment_tx_id: last.paymentTxId,
          currency_id: currencyId,
          amount: last.amount,
          note: note.trim() || null,
        },
      });
      await exportReceiptPDF({
        serialNumber: r.serial_number,
        personName,
        phone: r.phone,
        currencyName: currencyLabel,
        amount: r.amount,
        amountWords: r.amount_words,
        note: r.note,
        issuedAt: r.issued_at,
      });
      toast.success("تم توليد سند القبض");
      onOpenChange(false);
      setLast(null);
      setAmount("");
      setNote("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل توليد سند القبض");
    } finally {
      setReceiptBusy(false);
    }
  };

  const closeAll = () => {
    onOpenChange(false);
    setLast(null);
    setAmount("");
    setNote("");
    onDone();
  };

  const resetOnOpen = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setLast(null);
      setAmount("");
      setNote("");
      onDone();
    }
  };

  return (
    <Dialog open={open} onOpenChange={resetOnOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {last ? "تم تسجيل الدفعة" : `تسجيل دفعة — ${personName}`}
          </DialogTitle>
        </DialogHeader>

        {last ? (
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-success/30 bg-success/5 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-success shrink-0" />
                <div className="text-[13px] font-bold text-success tabular-nums">
                  {fmtMoney(last.amount)} {currencyLabel}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                {last.unallocated > 0.005
                  ? `خُصم ${fmtMoney(last.allocated)} من المستحقات وبقي ${fmtMoney(last.unallocated)} رصيداً للعميل`
                  : `تمت تسوية ${last.settledCount} مستحق`}
              </p>
            </div>
            <p className="text-[10.5px] text-muted-foreground bg-secondary rounded-lg p-2">
              هل تريد إصدار <span className="font-bold">سند قبض</span> للعميل؟ يُولَّد ملف PDF برقم
              تسلسلي يُحفظ في سجل السندات ويمكن إعادة طباعته لاحقاً.
            </p>
            <Button
              onClick={genReceipt}
              disabled={receiptBusy}
              className="w-full bg-gradient-primary text-primary-foreground"
            >
              {receiptBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ReceiptText className="size-4" />
              )}
              توليد سند قبض
            </Button>
            <Button onClick={closeAll} variant="outline" className="w-full h-9">
              إغلاق
            </Button>
          </div>
        ) : (
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
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} حفظ الدفعة
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
