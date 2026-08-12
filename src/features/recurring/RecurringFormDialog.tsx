import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AmountInput } from "@/components/AmountInput";
import { evalExpr } from "@/lib/calc";

interface Cur {
  id: string;
  name: string;
  is_base: boolean;
}
interface Person {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  curs: Cur[];
  people: Person[];
  onSaved: () => void;
}

export function RecurringFormDialog({ open, onOpenChange, userId, curs, people, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [personId, setPersonId] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [nextRun, setNextRun] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setAmount("");
    setNote("");
    setPersonId("");
    setDirection("credit");
    setFrequency("monthly");
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setNextRun(d.toISOString().slice(0, 16));
    const base = curs.find((c) => c.is_base) ?? curs[0];
    setCurrencyId(base?.id ?? "");
  }, [open, curs]);

  const save = async () => {
    if (!title.trim()) return toast.error("أدخل العنوان");
    const amt = evalExpr(amount);
    if (!isFinite(amt) || amt <= 0) return toast.error("مبلغ غير صحيح");
    if (!currencyId) return toast.error("اختر العملة");
    if (!personId) return toast.error("اختر العميل");
    setBusy(true);
    const { error } = await supabase.from("recurring_rules").insert({
      user_id: userId,
      kind: "transaction",
      title: title.trim(),
      amount: amt,
      currency_id: currencyId,
      category_id: null,
      person_id: personId,
      direction,
      frequency,
      next_run: new Date(nextRun).toISOString(),
      note: note.trim() || null,
      is_active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-primary text-primary-foreground">
          <Plus className="size-4" /> جديد
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">دورية جديدة</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>العنوان</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: راتب، إيجار، اشتراك"
              maxLength={80}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>المبلغ</Label>
              <AmountInput value={amount} onChange={setAmount} />
            </div>
            <div className="space-y-1.5">
              <Label>العملة</Label>
              <Select value={currencyId} onValueChange={setCurrencyId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {curs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>الشخص</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDirection("credit")}
              className={`p-2 rounded-xl border-2 text-xs font-semibold ${direction === "credit" ? "border-success bg-success-soft text-success" : "border-border"}`}
            >
              له (دائن)
            </button>
            <button
              onClick={() => setDirection("debit")}
              className={`p-2 rounded-xl border-2 text-xs font-semibold ${direction === "debit" ? "border-danger bg-danger-soft text-danger" : "border-border"}`}
            >
              عليه (مدين)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>التكرار</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as never)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">يومي</SelectItem>
                  <SelectItem value="weekly">أسبوعي</SelectItem>
                  <SelectItem value="monthly">شهري</SelectItem>
                  <SelectItem value="yearly">سنوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>أول تشغيل</Label>
              <Input
                type="datetime-local"
                dir="ltr"
                value={nextRun}
                onChange={(e) => setNextRun(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظة (اختياري)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </div>

          <Button
            onClick={save}
            disabled={busy}
            className="w-full bg-gradient-primary text-primary-foreground"
          >
            {busy ? "..." : "حفظ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
