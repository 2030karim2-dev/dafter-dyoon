import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  TrendingUp,
  TrendingDown,
  Check,
  ChevronDown,
  Paperclip,
  X,
  FileText,
  ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { AmountInput } from "@/components/AmountInput";
import { evalExpr } from "@/lib/calc";
import { toLocalDatetimeInputValue } from "@/lib/format";
import { AttachmentsManager } from "@/components/AttachmentsManager";

interface Person {
  id: string;
  name: string;
}
interface Currency {
  id: string;
  name: string;
  is_base: boolean;
}

interface EditingTx {
  id: string;
  person_id: string;
  amount: number;
  direction: string;
  currency_id: string;
  details: string | null;
  transaction_date: string;
  due_date?: string | null;
}

interface Prefill {
  newName?: string;
  amount?: number;
  direction?: "credit" | "debit";
  details?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  people: Person[];
  currencies: Currency[];
  onSuccess: () => void;
  defaultPersonId?: string;
  editing?: EditingTx | null;
  prefill?: Prefill | null;
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  people,
  currencies,
  onSuccess,
  defaultPersonId,
  editing,
  prefill,
}: Props) {
  const { user } = useAuth();
  const [personId, setPersonId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [currencyId, setCurrencyId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPersonId(editing.person_id);
      setNewName("");
      setAmount(String(editing.amount));
      setDetails(editing.details ?? "");
      setDirection(editing.direction as "credit" | "debit");
      setCurrencyId(editing.currency_id);
      // Show the stored instant in LOCAL time (ISO slice would shift it by the UTC offset).
      setDate(toLocalDatetimeInputValue(new Date(editing.transaction_date)));
      setDueDate(editing.due_date ? editing.due_date.slice(0, 10) : "");
    } else {
      const base = currencies.find((c) => c.is_base) ?? currencies[0];
      if (prefill) {
        const matched = prefill.newName
          ? people.find((p) => p.name.trim() === prefill.newName!.trim())
          : undefined;
        setPersonId(matched?.id ?? defaultPersonId ?? "");
        setNewName(matched ? "" : (prefill.newName ?? ""));
        setAmount(prefill.amount != null ? String(prefill.amount) : "");
        setDetails(prefill.details ?? "");
        setDirection(prefill.direction ?? "credit");
      } else {
        setPersonId(defaultPersonId ?? "");
        setNewName("");
        setAmount("");
        setDetails("");
        setDirection("credit");
      }
      setCurrencyId(base?.id ?? "");
      setDate(toLocalDatetimeInputValue(new Date()));
      setDueDate("");
    }
    setPendingFile(null);
  }, [open, defaultPersonId, currencies, editing, prefill, people]);

  const submit = async () => {
    if (!user) return;
    const amt = evalExpr(amount);
    if (!isFinite(amt) || amt <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    if (!currencyId) {
      toast.error("اختر العملة");
      return;
    }
    let pid = personId;
    setBusy(true);
    try {
      if (!pid && !editing) {
        const name = newName.trim();
        if (!name) {
          toast.error("اختر شخصاً أو أدخل اسماً جديداً");
          setBusy(false);
          return;
        }
        const { data, error } = await supabase
          .from("people")
          .insert({ name, user_id: user.id })
          .select("id")
          .single();
        if (error) throw error;
        pid = data.id;
      }
      const payload = {
        user_id: user.id,
        person_id: pid,
        currency_id: currencyId,
        amount: amt,
        direction,
        details: details.trim() || null,
        transaction_date: new Date(date).toISOString(),
        due_date: dueDate || null,
      };
      const { data: txData, error: te } = editing
        ? await supabase
            .from("transactions")
            .update(payload)
            .eq("id", editing.id)
            .select("id")
            .single()
        : await supabase.from("transactions").insert(payload).select("id").single();
      if (te) throw te;
      const newTxId = (txData as { id: string } | null)?.id ?? editing?.id;
      // Upload pending attachment if any
      if (pendingFile && newTxId) {
        try {
          if (pendingFile.size > 5 * 1024 * 1024) {
            toast.error("المرفق تجاوز 5MB ولم يُرفع");
          } else {
            const ext = pendingFile.name.split(".").pop() || "bin";
            const path = `${user.id}/transaction/${newTxId}/${Date.now()}.${ext}`;
            const { error: ue } = await supabase.storage.from("receipts").upload(path, pendingFile);
            if (ue) throw ue;
            await supabase.from("attachments").insert({
              user_id: user.id,
              entity_type: "transaction",
              entity_id: newTxId,
              storage_path: path,
              file_name: pendingFile.name,
              mime_type: pendingFile.type,
              size_bytes: pendingFile.size,
            });
          }
        } catch (err) {
          const e = err as { message?: string };
          toast.error("فشل رفع المرفق: " + (e.message ?? ""));
        }
      }
      const { logAudit } = await import("@/lib/audit");
      await logAudit(user.id, editing ? "update" : "create", "transaction", newTxId, {
        amount: payload.amount,
        direction: payload.direction,
      });
      toast.success(editing ? "تم التعديل" : "تمت الإضافة");
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message ?? "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  const selectedPerson = people.find((p) => p.id === personId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">
            {editing ? "تعديل معاملة" : "إضافة معاملة"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>الشخص</Label>
            {editing ? (
              <Input value={selectedPerson?.name ?? ""} disabled />
            ) : (
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {selectedPerson ? selectedPerson.name : newName || "اختر أو أضف اسماً جديداً"}
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput
                      placeholder="ابحث أو اكتب اسماً جديداً..."
                      value={newName}
                      onValueChange={(v) => {
                        setNewName(v);
                        setPersonId("");
                      }}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="text-sm">سيُنشأ شخص جديد باسم "{newName}"</div>
                      </CommandEmpty>
                      <CommandGroup>
                        {people.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={p.name}
                            onSelect={() => {
                              setPersonId(p.id);
                              setNewName("");
                              setPickerOpen(false);
                            }}
                          >
                            <Check
                              className={`size-4 ${personId === p.id ? "opacity-100" : "opacity-0"}`}
                            />
                            {p.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                  {currencies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>التاريخ والوقت</Label>
              <Input
                type="datetime-local"
                dir="ltr"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الاستحقاق (اختياري)</Label>
              <Input
                type="date"
                dir="ltr"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>التفاصيل (اختياري)</Label>
            <Textarea
              rows={2}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="مثلاً: ماء ديتر وكاله"
              maxLength={500}
            />
          </div>

          <RadioGroup
            value={direction}
            onValueChange={(v) => setDirection(v as "credit" | "debit")}
            className="grid grid-cols-2 gap-2"
          >
            <label
              className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 cursor-pointer transition-all ${direction === "credit" ? "border-success bg-success-soft text-success" : "border-border"}`}
            >
              <RadioGroupItem value="credit" className="sr-only" />
              <TrendingUp className="size-4" /> له (دائن)
            </label>
            <label
              className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 cursor-pointer transition-all ${direction === "debit" ? "border-danger bg-danger-soft text-danger" : "border-border"}`}
            >
              <RadioGroupItem value="debit" className="sr-only" />
              <TrendingDown className="size-4" /> عليه (مدين)
            </label>
          </RadioGroup>

          {editing ? (
            <div className="pt-2 border-t">
              <AttachmentsManager entityType="transaction" entityId={editing.id} />
            </div>
          ) : (
            <div className="pt-2 border-t space-y-1.5">
              <Label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Paperclip className="size-3.5" /> إرفاق مستند (اختياري — فاتورة، سند، صورة)
              </Label>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 5 * 1024 * 1024) {
                    toast.error("الحد الأقصى 5MB");
                    return;
                  }
                  setPendingFile(f);
                }}
              />
              {pendingFile ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-primary/30 bg-primary/5 px-2.5 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {pendingFile.type.startsWith("image/") ? (
                      <ImageIcon className="size-4 text-primary shrink-0" />
                    ) : (
                      <FileText className="size-4 text-primary shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium truncate">{pendingFile.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {(pendingFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="p-1 rounded hover:bg-danger/10 text-danger shrink-0"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary px-3 py-3 text-[12px] font-medium transition-colors"
                >
                  <Paperclip className="size-4" />
                  اختر ملفاً للرفع (PDF أو صورة، حد أقصى 5MB)
                </button>
              )}
            </div>
          )}

          <Button
            onClick={submit}
            disabled={busy}
            className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {busy ? "..." : editing ? "حفظ التعديلات" : "حفظ المعاملة"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
