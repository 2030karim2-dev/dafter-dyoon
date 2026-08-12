import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { parseDebtText } from "@/lib/ai.functions";
import { toast } from "sonner";

export interface ParsedDraft {
  person_name: string;
  amount: number;
  direction: "credit" | "debit";
  details: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onParsed: (draft: ParsedDraft) => void;
}

const EXAMPLES = [
  "أعطيت أحمد 500 ريال قرض",
  "استلمت من سامي 200 سداد ديون",
  "خالد أخذ 1200 لإصلاح السيارة",
];

export function SmartAddDialog({ open, onOpenChange, onParsed }: Props) {
  const parse = useServerFn(parseDebtText);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (text.trim().length < 3) return toast.error("اكتب وصفاً أوضح");
    setBusy(true);
    try {
      const draft = await parse({ data: { text: text.trim() } });
      onParsed(draft as ParsedDraft);
      setText("");
      onOpenChange(false);
      toast.success("تم التحليل — راجع البيانات");
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message ?? "تعذّر التحليل");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-1.5">
            <Wand2 className="size-4 text-primary" /> إضافة ذكية
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            اكتب المعاملة بلغتك الطبيعية وسيقوم الذكاء الاصطناعي بتعبئة الحقول.
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="مثال: أعطيت أحمد 500 ريال قرض"
            className="text-[13px]"
          />
          <div className="flex flex-wrap gap-1">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                onClick={() => setText(e)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-secondary hover:bg-secondary/70"
              >
                {e}
              </button>
            ))}
          </div>
          <Button
            onClick={run}
            disabled={busy}
            className="w-full bg-gradient-primary text-primary-foreground"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="size-4 ms-1" /> تحليل
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
