import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import {
  buildPaymentRequestFn,
  walletLabel,
  type PaymentRequestPayload,
} from "@/lib/wallets.functions";
import { waPhone } from "@/lib/phone";
import { fmtMoney } from "@/lib/format";
import { Send, Copy, HandCoins, Loader2, Settings2, QrCode } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personId: string;
  personName: string;
  currencyId: string;
  currencyLabel: string;
  amount: number;
  /** تُستدعى عند تأكيد الاستلام لتفتح نافذة تسجيل الدفعة. */
  onConfirm: () => void;
}

/**
 * طلب سداد عبر المحافظ اليمنية (نظام فوترة المحافظ):
 * يعرض QR Code + رسالة سداد بأرقام المحافظ، مع زر واتساب وزر تأكيد الاستلام
 * الذي يحوّل العملية إلى تسجيل الدفعة + سند القبض.
 */
export function PaymentRequestSheet({
  open,
  onOpenChange,
  personId,
  personName,
  currencyId,
  currencyLabel,
  amount,
  onConfirm,
}: Props) {
  const build = useServerFn(buildPaymentRequestFn);
  const [payload, setPayload] = useState<PaymentRequestPayload | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setPayload(null);
      setQr(null);
      return;
    }
    let cancel = false;
    setBusy(true);
    build({ data: { person_id: personId, currency_id: currencyId, amount } })
      .then(async (p) => {
        if (cancel) return;
        setPayload(p);
        if (p.wallets.length > 0) {
          const url = await QRCode.toDataURL(p.qr_payload, {
            width: 480,
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#1d4ed8", light: "#ffffff" },
          });
          if (!cancel) setQr(url);
        }
      })
      .catch((e) => {
        if (!cancel) toast.error(e instanceof Error ? e.message : "فشل تحضير طلب السداد");
      })
      .finally(() => {
        if (!cancel) setBusy(false);
      });
    return () => {
      cancel = true;
    };
  }, [open, personId, currencyId, amount, build]);

  const sendWhatsApp = () => {
    if (!payload) return;
    const text = encodeURIComponent(payload.message);
    const p = waPhone(payload.person_phone);
    window.open(p ? `https://wa.me/${p}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
  };

  const copy = async () => {
    if (!payload) return;
    await navigator.clipboard.writeText(payload.message);
    toast.success("تم نسخ رسالة السداد");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">طلب سداد — {personName}</DialogTitle>
        </DialogHeader>
        {busy && !payload ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : !payload ? null : payload.wallets.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground bg-secondary rounded-lg p-2 leading-relaxed">
              لا توجد محافظ مفعّلة بعد. أضف أرقام محافظك من{" "}
              <span className="font-bold">الإعدادات ← بيانات المنشأة</span> ليتمكن العملاء من السداد
              عبر QR.
            </p>
            <Button
              onClick={() => {
                onOpenChange(false);
                window.location.href = "/app/settings/company";
              }}
              variant="outline"
              className="w-full h-9 text-xs"
            >
              <Settings2 className="size-3.5" /> فتح إعدادات المحافظ
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="w-full h-9 text-xs"
            >
              إغلاق
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 text-center">
              <div className="text-[10px] text-muted-foreground">المبلغ المستحق</div>
              <div className="font-black text-lg text-primary tabular-nums">
                {fmtMoney(payload.amount)} {currencyLabel}
              </div>
            </div>

            <div className="flex justify-center">
              {qr ? (
                <img
                  src={qr}
                  alt="QR سداد"
                  className="size-44 rounded-lg ring-1 ring-border bg-white"
                />
              ) : (
                <div className="size-44 rounded-lg ring-1 ring-border bg-secondary flex items-center justify-center">
                  <QrCode className="size-8 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="space-y-1">
              {payload.wallets.map((w) => (
                <div
                  key={w.provider}
                  className="flex items-center justify-between gap-2 text-[11px] bg-secondary rounded-lg px-2 py-1.5"
                >
                  <span className="font-bold shrink-0">{walletLabel(w.provider)}</span>
                  <span className="tabular-nums truncate" dir="ltr">
                    {w.account_number}
                    {w.holder_name ? ` — ${w.holder_name}` : ""}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border p-2 bg-card">
              <p className="text-[10.5px] whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                {payload.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={sendWhatsApp}
                className="bg-gradient-primary text-primary-foreground h-9 text-xs"
              >
                <Send className="size-3.5" /> واتساب
              </Button>
              <Button onClick={copy} variant="outline" className="h-9 text-xs">
                <Copy className="size-3.5" /> نسخ
              </Button>
            </div>

            <Button
              onClick={() => {
                onOpenChange(false);
                onConfirm();
              }}
              variant="outline"
              className="w-full h-9 text-xs"
            >
              <HandCoins className="size-3.5" /> تأكيد الاستلام وتسجيل الدفعة
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
