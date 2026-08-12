import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { hashPin } from "@/lib/pin";
import {
  biometricAvailable,
  biometricEnabled,
  registerBiometric,
  disableBiometric,
  verifyBiometric,
} from "@/lib/biometric";
import { Lock, ShieldCheck, Fingerprint } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/security")({ component: SecurityPage });

const AUTOLOCK_KEY = "daftarak.autolock.minutes";

function SecurityPage() {
  const { user } = useAuth();
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [autolock, setAutolock] = useState<number>(5);
  const [biometric, setBiometric] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("pin_hash")
        .eq("user_id", user.id)
        .maybeSingle();
      setHasPin(!!data?.pin_hash);
    })();
    try {
      const v = Number(localStorage.getItem(AUTOLOCK_KEY) ?? "5");
      setAutolock(isNaN(v) ? 5 : v);
      setBiometric(biometricEnabled());
    } catch {
      /* ignore */
    }
    biometricAvailable().then(setBioSupported);
  }, [user]);

  const setPinCode = async () => {
    if (!user) return;
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) return toast.error("الرقم يجب أن يكون 4 أرقام");
    if (pin !== pin2) return toast.error("الرقمان غير متطابقين");
    setBusy(true);
    const h = await hashPin(pin, user.id);
    const { error } = await supabase
      .from("profiles")
      .update({ pin_hash: h })
      .eq("user_id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setHasPin(true);
    setPin("");
    setPin2("");
    toast.success("تم تفعيل القفل");
  };

  const removePin = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ pin_hash: null })
      .eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setHasPin(false);
    toast.success("تم إلغاء القفل");
  };

  const saveAutolock = (v: number) => {
    setAutolock(v);
    try {
      localStorage.setItem(AUTOLOCK_KEY, String(v));
    } catch {
      /* ignore */
    }
  };

  const toggleBio = async (v: boolean) => {
    if (!user) return;
    if (!v) {
      disableBiometric();
      setBiometric(false);
      toast.success("تم تعطيل البصمة");
      return;
    }
    if (!hasPin) return toast.error("فعّل القفل برقم سري أولاً");
    if (!bioSupported) return toast.error("جهازك لا يدعم البصمة");
    try {
      await registerBiometric(user.id, user.email ?? "Daftarak");
      setBiometric(true);
      toast.success("تم تفعيل البصمة");
    } catch (e) {
      toast.error("تعذّر تسجيل البصمة");
      setBiometric(false);
    }
  };

  const testBio = async () => {
    const ok = await verifyBiometric();
    toast[ok ? "success" : "error"](ok ? "تم التحقق بنجاح" : "فشل التحقق");
  };

  return (
    <div className="space-y-2.5">
      <PageHeader
        icon={ShieldCheck}
        title="الأمان والخصوصية"
        subtitle="حماية بياناتك المالية"
        back="/app/settings"
      />

      <Card className="p-2.5 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-secondary text-primary flex items-center justify-center ring-1 ring-border">
            <Lock className="size-3.5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[12px] leading-tight">قفل التطبيق برقم سري</div>
            <div className="text-[10px] text-muted-foreground">
              {hasPin ? "مفعّل" : "غير مفعّل"}
            </div>
          </div>
        </div>
        {hasPin ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmRemove(true)}
            className="w-full h-8 text-[12px] text-danger border-danger/30"
          >
            إلغاء القفل
          </Button>
        ) : (
          <div className="space-y-1.5">
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="رقم من 4 خانات"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              dir="ltr"
              className="h-9 text-sm"
            />
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="تأكيد الرقم"
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
              dir="ltr"
              className="h-9 text-sm"
            />
            <Button
              size="sm"
              onClick={setPinCode}
              disabled={busy}
              className="w-full h-8 text-[12px] bg-gradient-primary text-primary-foreground"
            >
              تفعيل القفل
            </Button>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          ملاحظة: القفل يمنع العرض على هذا الجهاز فقط ولا يشفّر بياناتك — حماية حسابك الأساسية هي
          كلمة مرورك وسياسات الأمان السحابية.
        </p>
      </Card>

      {hasPin && (
        <Card className="p-2.5 space-y-2">
          <Label className="text-[11px]">القفل التلقائي بعد</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 5, 15, 30].map((m) => (
              <button
                key={m}
                onClick={() => saveAutolock(m)}
                className={`py-1.5 rounded-md text-[12px] font-semibold transition-all ${autolock === m ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"}`}
              >
                {m} د
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            يقفل التطبيق بعد عدم النشاط لهذه المدة.
          </p>
        </Card>
      )}

      <Card className={`p-2.5 space-y-2 ${!hasPin || !bioSupported ? "opacity-70" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-8 rounded-lg bg-secondary text-primary flex items-center justify-center ring-1 ring-border shrink-0">
              <Fingerprint className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[12px] leading-tight">البصمة / Face ID</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {!bioSupported
                  ? "غير مدعومة على هذا الجهاز"
                  : !hasPin
                    ? "يتطلب تفعيل الرقم السري"
                    : biometric
                      ? "مفعّلة"
                      : "غير مفعّلة"}
              </div>
            </div>
          </div>
          <Switch
            checked={biometric}
            onCheckedChange={toggleBio}
            disabled={!bioSupported || !hasPin}
          />
        </div>
        {biometric && (
          <Button size="sm" variant="outline" onClick={testBio} className="w-full h-8 text-[11px]">
            اختبار البصمة
          </Button>
        )}
      </Card>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="إلغاء قفل التطبيق؟"
        description="سيتمكن أي شخص من الوصول لبياناتك."
        confirmLabel="إلغاء القفل"
        destructive
        onConfirm={removePin}
      />
    </div>
  );
}
