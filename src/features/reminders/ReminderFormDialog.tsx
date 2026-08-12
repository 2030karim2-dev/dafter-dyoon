import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Reminder, RepeatKind } from "@/lib/reminders";
import { REPEAT_LABEL } from "./ReminderCard";

interface Person {
  id: string;
  name: string;
}
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Reminder | null;
  userId: string;
  people: Person[];
  onSaved: () => void;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReminderFormDialog({
  open,
  onOpenChange,
  editing,
  userId,
  people,
  onSaved,
}: Props) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [personId, setPersonId] = useState("");
  const [repeat, setRepeat] = useState<RepeatKind>("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setNote(editing.note ?? "");
      setPersonId(editing.person_id ?? "");
      setRepeat((editing.repeat as RepeatKind) ?? "none");
      setDate(toLocalInput(editing.due_date));
    } else {
      setTitle("");
      setNote("");
      setPersonId("");
      setRepeat("none");
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      setDate(toLocalInput(d.toISOString()));
    }
  }, [open, editing]);

  const save = async () => {
    if (!title.trim()) return toast.error("أدخل عنوان التذكير");
    if (!date) return toast.error("اختر التاريخ");
    setBusy(true);
    const payload = {
      title: title.trim(),
      note: note.trim() || null,
      due_date: new Date(date).toISOString(),
      person_id: personId || null,
      repeat,
    };
    const { error } = editing
      ? await supabase.from("reminders").update(payload).eq("id", editing.id)
      : await supabase.from("reminders").insert({ ...payload, user_id: userId, is_done: false });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "تم التحديث" : "تم الإضافة");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-8 text-[11px] gap-1 bg-gradient-primary text-primary-foreground ml-auto"
        >
          <Plus className="size-3" /> جديد
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">{editing ? "تعديل تذكير" : "تذكير جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>العنوان</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: استرداد دين أحمد"
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label>التاريخ والوقت</Label>
            <Input
              type="datetime-local"
              dir="ltr"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>التكرار</Label>
              <Select value={repeat} onValueChange={(v) => setRepeat(v as RepeatKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(REPEAT_LABEL) as RepeatKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {REPEAT_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الشخص</Label>
              <Select
                value={personId || "none"}
                onValueChange={(v) => setPersonId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="بدون" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>ملاحظة</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
            />
          </div>
          <Button
            onClick={save}
            disabled={busy}
            className="w-full bg-gradient-primary text-primary-foreground"
          >
            {editing ? "حفظ" : "إضافة"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
