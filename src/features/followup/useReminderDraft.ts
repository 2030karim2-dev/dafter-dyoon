import { useState } from "react";
import { toast } from "sonner";
import { generateReminderMessage } from "@/lib/ai.functions";
import { fmtMoney } from "@/lib/format";
import type { Bucket } from "@/lib/followup/severity";

export type Tone = "polite" | "firm" | "friendly";

/** Open a customer's WhatsApp chat with a prefilled message. */
export function openWhatsApp(b: Bucket, text: string) {
  if (!b.person.phone) {
    toast.error("لا يوجد رقم هاتف لهذا العميل");
    return;
  }
  const phone = b.person.phone.replace(/[^\d]/g, "");
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
}

export function quickReminderText(b: Bucket) {
  return `السلام عليكم ${b.person.name}،\nتذكير ودي بمبلغ ${fmtMoney(b.net)} ${b.currency} المستحق.\nشكراً لتعاونكم.`;
}

function fallbackText(b: Bucket) {
  const dayPart = b.daysOverdue > 0 ? `\nتأخر السداد ${b.daysOverdue} يوم.` : "";
  return `السلام عليكم ${b.person.name}،\nنود تذكيركم بمبلغ ${fmtMoney(b.net)} ${b.currency} المستحق علينا.${dayPart}\nنشكر تعاونكم — وفقكم الله.`;
}

/** AI reminder draft state for the follow-up page. */
export function useReminderDraft() {
  const [draftFor, setDraftFor] = useState<Bucket | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async (b: Bucket, tone: Tone = "polite") => {
    setDraftFor(b);
    setText("");
    setLoading(true);
    try {
      const res = await generateReminderMessage({
        data: {
          person_name: b.person.name,
          amount: b.net,
          currency: b.currency,
          days_overdue: b.daysOverdue > 0 ? b.daysOverdue : undefined,
          tone,
        },
      });
      setText(res.message);
    } catch {
      setText(fallbackText(b));
      toast.message("استخدمنا قالب جاهز (الذكاء الاصطناعي غير متاح حالياً)");
    } finally {
      setLoading(false);
    }
  };

  return { draftFor, text, loading, setText, generate, close: () => setDraftFor(null) };
}
