import { Button } from "@/components/ui/button";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Bucket } from "@/lib/followup/severity";
import type { Tone } from "./useReminderDraft";

interface Props {
  bucket: Bucket;
  text: string;
  loading: boolean;
  onTextChange: (v: string) => void;
  onTone: (t: Tone) => void;
  onSend: () => void;
  onClose: () => void;
}

const TONES: { v: Tone; label: string }[] = [
  { v: "polite", label: "مهذبة" },
  { v: "friendly", label: "ودية" },
  { v: "firm", label: "حازمة" },
];

export function AiDraftSheet({
  bucket,
  text,
  loading,
  onTextChange,
  onTone,
  onSend,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl border shadow-elevated w-full max-w-md p-3 space-y-2.5 animate-in slide-in-from-bottom-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="font-bold text-sm flex items-center gap-1.5">
            <Sparkles className="size-4 text-primary" /> رسالة لـ {bucket.person.name}
          </div>
          <button onClick={onClose} className="text-muted-foreground text-xs">
            ✕
          </button>
        </div>

        <div className="flex gap-1">
          {TONES.map((t) => (
            <button
              key={t.v}
              onClick={() => onTone(t.v)}
              className="text-[10px] px-2 py-1 rounded border bg-secondary hover:bg-primary hover:text-primary-foreground transition"
            >
              {t.label}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          rows={7}
          dir="rtl"
          className="w-full text-[12px] p-2 rounded border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={loading ? "جاري توليد الرسالة..." : "اكتب أو عدّل الرسالة..."}
        />

        {loading && (
          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> جاري التوليد بالذكاء الاصطناعي...
          </div>
        )}

        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8"
            onClick={() => {
              void navigator.clipboard.writeText(text);
              toast.success("تم النسخ");
            }}
          >
            نسخ
          </Button>
          <Button
            size="sm"
            className="flex-1 h-8 bg-success text-success-foreground hover:bg-success/90"
            disabled={!text.trim()}
            onClick={onSend}
          >
            <Send className="size-3" /> إرسال واتساب
          </Button>
        </div>
      </div>
    </div>
  );
}
