import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, MessageCircle, Inbox } from "lucide-react";
import { toast } from "sonner";

interface Props {
  name: string;
  body: string;
  loading: boolean;
  phone: string | null;
  canAuto: boolean;
  onBodyChange: (v: string) => void;
  onQueue: () => void;
  onAutoSend: () => void;
  onClose: () => void;
}

/** Displays the message the backend rendered. The UI only edits/sends it. */
export function MessageSheet({
  name,
  body,
  loading,
  phone,
  canAuto,
  onBodyChange,
  onQueue,
  onAutoSend,
  onClose,
}: Props) {
  const [busy, setBusy] = useState(false);

  const openWhatsApp = () => {
    if (!phone) return toast.error("لا يوجد رقم جوال لهذا العميل");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(body)}`, "_blank");
    onQueue();
  };

  const auto = async () => {
    setBusy(true);
    try {
      await onAutoSend();
    } finally {
      setBusy(false);
    }
  };

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
          <div className="font-bold text-[13px] flex items-center gap-1.5">
            <MessageCircle className="size-4 text-primary" /> رسالة إلى {name}
          </div>
          <button onClick={onClose} className="text-muted-foreground text-xs" aria-label="إغلاق">
            ✕
          </button>
        </div>

        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          rows={9}
          dir="rtl"
          className="w-full text-[12px] p-2 rounded border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={loading ? "يتم تجهيز الرسالة من الخادم..." : "نص الرسالة"}
        />

        {loading && (
          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> يتم التجهيز في الواجهة الخلفية...
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[11px]"
            onClick={() => {
              void navigator.clipboard.writeText(body);
              toast.success("تم النسخ");
            }}
          >
            نسخ
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={onQueue}>
            <Inbox className="size-3" /> حفظ في الصادر
          </Button>
          <Button
            size="sm"
            className="h-8 text-[11px] bg-success text-success-foreground hover:bg-success/90"
            disabled={!body.trim()}
            onClick={openWhatsApp}
          >
            <Send className="size-3" /> واتساب
          </Button>
          <Button
            size="sm"
            className="h-8 text-[11px]"
            disabled={!canAuto || busy || !body.trim()}
            onClick={auto}
            title={canAuto ? "" : "الإرسال التلقائي غير مفعّل"}
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />} إرسال
            تلقائي
          </Button>
        </div>
      </div>
    </div>
  );
}
