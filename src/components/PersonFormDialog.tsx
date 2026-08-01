import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { UserPlus, Save } from "lucide-react";

export interface PersonEditing {
  id: string;
  name: string;
  phone: string | null;
  type: string;
  notes: string | null;
  avatar_color: string | null;
  credit_limit: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: PersonEditing | null;
  onSuccess: (id: string) => void;
}

const COLORS = ["#3b82f6", "#10b981", "#f97316", "#ec4899", "#8b5cf6", "#ef4444", "#06b6d4", "#a16207"];
const TYPES = [
  { v: "customer", label: "عميل" },
  { v: "supplier", label: "مورّد" },
  { v: "employee", label: "موظف" },
  { v: "other", label: "أخرى" },
];

export function PersonFormDialog({ open, onOpenChange, editing, onSuccess }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState("customer");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState<string>(COLORS[0]);
  const [creditLimit, setCreditLimit] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setPhone(editing.phone ?? "");
      setType(editing.type || "customer");
      setNotes(editing.notes ?? "");
      setColor(editing.avatar_color ?? COLORS[0]);
      setCreditLimit(editing.credit_limit != null ? String(editing.credit_limit) : "");
    } else {
      setName(""); setPhone(""); setType("customer"); setNotes("");
      setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
      setCreditLimit("");
    }
  }, [open, editing]);

  const submit = async () => {
    if (!user) return;
    const nm = name.trim();
    if (!nm) { toast.error("الاسم مطلوب"); return; }
    setBusy(true);
    try {
      const payload = {
        user_id: user.id,
        name: nm,
        phone: phone.trim() || null,
        type,
        notes: notes.trim() || null,
        avatar_color: color,
        credit_limit: creditLimit ? Number(creditLimit) : null,
      };
      const { data, error } = editing
        ? await supabase.from("people").update(payload).eq("id", editing.id).select("id").single()
        : await supabase.from("people").insert(payload).select("id").single();
      if (error) throw error;
      toast.success(editing ? "تم الحفظ" : "تمت إضافة العميل");
      onSuccess(data!.id);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            {editing ? <Save className="size-4 text-primary" /> : <UserPlus className="size-4 text-primary" />}
            {editing ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[12px]">الاسم *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم العميل" maxLength={80} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[12px]">رقم الجوال</Label>
              <div className="flex items-center gap-1">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9665xxxxxxxx" dir="ltr" maxLength={30} inputMode="tel" className="flex-1" />
                <button
                  type="button"
                  onClick={async () => {
                    if (!contactPickerSupported()) {
                      toast.info("جهات الاتصال غير مدعومة في هذا المتصفح — افتح التطبيق من متصفح الجوال (Chrome).");
                      return;
                    }
                    try {
                      const c = await pickContact();
                      if (!c) return;
                      if (c.phone) setPhone(c.phone);
                      if (c.name && !name.trim()) setName(c.name);
                      if (!c.phone) toast.info("جهة الاتصال المختارة لا تحتوي رقماً");
                    } catch {
                      toast.error("تم إلغاء اختيار جهة الاتصال");
                    }
                  }}
                  aria-label="استيراد رقم من جهات الاتصال"
                  title="اختيار رقم من جهات الاتصال بالهاتف"
                  className="size-9 shrink-0 rounded-md border bg-secondary text-primary flex items-center justify-center hover:bg-primary/10 active:scale-95 transition"
                >
                  <BookUser className="size-4" />
                </button>
              </div>
            </div>
            <div>
              <Label className="text-[12px]">النوع</Label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full h-9 rounded-md border bg-background px-2 text-[12.5px]">
                {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-[12px]">سقف الائتمان (اختياري)</Label>
            <Input value={creditLimit} onChange={(e) => setCreditLimit(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" inputMode="decimal" dir="ltr" />
          </div>
          <div>
            <Label className="text-[12px]">لون البطاقة</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  className={`size-7 rounded-full ring-2 transition ${color === c ? "ring-primary scale-110" : "ring-border"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[12px]">ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="عنوان، تفاصيل، أو ملاحظات داخلية" rows={2} maxLength={400} />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">
            {busy ? "جارٍ الحفظ..." : editing ? "حفظ التعديلات" : "إضافة العميل"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
