import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Copy, MessageCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateReminderMessage } from "@/lib/ai.functions";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personName: string;
  amount: number;
  currency?: string;
  phone?: string | null;
  daysOverdue?: number;
}

export function AiReminderDialog({
  open,
  onOpenChange,
  personName,
  amount,
  currency,
  phone,
  daysOverdue,
}: Props) {
  const gen = useServerFn(generateReminderMessage);
  const [tone, setTone] = useState<"polite" | "firm" | "friendly">("polite");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await gen({
        data: { person_name: personName, amount, currency, days_overdue: daysOverdue, tone },
      });
      setMsg(r.message);
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message ?? "تعذّر توليد الرسالة");
    } finally {
      setBusy(false);
    }
  };

  const sendWa = () => {
    const text = encodeURIComponent(msg);
    const p = phone ? phone.replace(/\D/g, "") : "";
    window.open(p ? `https://wa.me/${p}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(msg);
    toast.success("تم النسخ");
  };

  const TONES: Array<{ id: typeof tone; label: string }> = [
    { id: "polite", label: "مهذبة" },
    { id: "friendly", label: "ودية" },
    { id: "firm", label: "حازمة" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-1.5">
            <Sparkles className="size-4 text-primary" /> رسالة ذكية
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-[11px] text-muted-foreground">
            إلى: <b className="text-foreground">{personName}</b> · {amount} {currency ?? ""}
          </div>
          <div className="flex gap-1">
            {TONES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                className={`flex-1 text-[11px] py-1.5 rounded-lg font-semibold ${tone === t.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button
            onClick={run}
            disabled={busy}
            className="w-full bg-gradient-primary text-primary-foreground h-9"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="size-4 ms-1" /> توليد بالذكاء الاصطناعي
              </>
            )}
          </Button>
          {msg && (
            <>
              <Textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={6}
                className="text-[13px]"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={copy} variant="outline" size="sm" className="gap-1">
                  <Copy className="size-3.5" /> نسخ
                </Button>
                <Button
                  onClick={sendWa}
                  size="sm"
                  className="gap-1 bg-success text-success-foreground hover:opacity-90"
                >
                  <MessageCircle className="size-3.5" /> واتساب
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
