import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, MessageCircle, Send, Radio } from "lucide-react";
import {
  getFollowupSettingsFn,
  saveChannelSettingsFn,
  saveFollowupPolicyFn,
} from "@/lib/followup.functions";
import { createTelegramLinkFn, testTelegramFn } from "@/lib/messaging.functions";

export const Route = createFileRoute("/app/settings/channels")({
  component: ChannelsPage,
  head: () => ({
    meta: [
      { title: "قنوات التذكير وسياسة المتابعة | دفترك" },
      {
        name: "description",
        content: "اضبط واتساب وتليجرام والرسائل النصية وسياسة التذكير التلقائي للعملاء.",
      },
      { property: "og:title", content: "قنوات التذكير وسياسة المتابعة | دفترك" },
      {
        property: "og:description",
        content: "تحكم في مواعيد التذكير وساعات الهدوء وقنوات الإرسال.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ChannelsPage() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getFollowupSettingsFn);
  const savePolicy = useServerFn(saveFollowupPolicyFn);
  const saveChannels = useServerFn(saveChannelSettingsFn);
  const createLink = useServerFn(createTelegramLinkFn);
  const testTg = useServerFn(testTelegramFn);

  const { data, isLoading } = useQuery({
    queryKey: ["followup-settings"],
    queryFn: () => fetchSettings(),
  });

  const [pol, setPol] = useState({
    days_before: 3,
    overdue_every_days: 7,
    max_reminders: 5,
    quiet_start: 21,
    quiet_end: 8,
    auto_send: false,
    daily_digest: true,
  });
  const [ch, setCh] = useState({
    whatsapp_enabled: true,
    whatsapp_auto: false,
    whatsapp_from: "" as string,
    telegram_enabled: false,
    sms_enabled: false,
    sms_from: "" as string,
    signature_name: "" as string,
  });
  const [linkCode, setLinkCode] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const p = data.policy as typeof pol;
    setPol({
      days_before: p.days_before,
      overdue_every_days: p.overdue_every_days,
      max_reminders: p.max_reminders,
      quiet_start: p.quiet_start,
      quiet_end: p.quiet_end,
      auto_send: p.auto_send,
      daily_digest: p.daily_digest,
    });
    if (data.channels) {
      setCh({
        whatsapp_enabled: data.channels.whatsapp_enabled,
        whatsapp_auto: data.channels.whatsapp_auto,
        whatsapp_from: data.channels.whatsapp_from ?? "",
        telegram_enabled: data.channels.telegram_enabled,
        sms_enabled: data.channels.sms_enabled,
        sms_from: data.channels.sms_from ?? "",
        signature_name: data.channels.signature_name ?? data.company_name ?? "",
      });
      setLinkCode(data.channels.telegram_link_code);
    } else {
      setCh((c) => ({ ...c, signature_name: data.company_name ?? "" }));
    }
  }, [data]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["followup-settings"] });
    void qc.invalidateQueries({ queryKey: ["followup-board"] });
  };

  const mPol = useMutation({
    mutationFn: () => savePolicy({ data: pol }),
    onSuccess: () => {
      toast.success("تم حفظ سياسة المتابعة");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mCh = useMutation({
    mutationFn: () =>
      saveChannels({
        data: {
          ...ch,
          whatsapp_from: ch.whatsapp_from.trim() || null,
          sms_from: ch.sms_from.trim() || null,
          signature_name: ch.signature_name.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("تم حفظ إعدادات القنوات");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mLink = useMutation({
    mutationFn: () => createLink(),
    onSuccess: (r) => {
      setLinkCode(r.code);
      toast.success("تم توليد كود الربط");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mTest = useMutation({
    mutationFn: () => testTg(),
    onSuccess: () => toast.success("تم إرسال رسالة تجريبية"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  const av = data?.availability;
  const chatLinked = Boolean(data?.channels?.telegram_chat_id);

  return (
    <div className="space-y-2.5">
      <PageHeader
        icon={Radio}
        title="قنوات التذكير"
        subtitle="سياسة المتابعة وإعدادات الإرسال"
        back="/app/settings"
      />

      <Card className="p-2.5 space-y-2">
        <div className="font-bold text-[12px]">سياسة المتابعة</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px]">تذكير قبل الاستحقاق (أيام)</Label>
            <Input
              dir="ltr"
              inputMode="numeric"
              value={pol.days_before}
              onChange={(e) => setPol({ ...pol, days_before: Number(e.target.value || 0) })}
            />
          </div>
          <div>
            <Label className="text-[11px]">تكرار التذكير بعد التأخير (أيام)</Label>
            <Input
              dir="ltr"
              inputMode="numeric"
              value={pol.overdue_every_days}
              onChange={(e) => setPol({ ...pol, overdue_every_days: Number(e.target.value || 1) })}
            />
          </div>
          <div>
            <Label className="text-[11px]">أقصى عدد تذكيرات</Label>
            <Input
              dir="ltr"
              inputMode="numeric"
              value={pol.max_reminders}
              onChange={(e) => setPol({ ...pol, max_reminders: Number(e.target.value || 1) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div>
              <Label className="text-[11px]">هدوء من</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                value={pol.quiet_start}
                onChange={(e) => setPol({ ...pol, quiet_start: Number(e.target.value || 0) })}
              />
            </div>
            <div>
              <Label className="text-[11px]">إلى</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                value={pol.quiet_end}
                onChange={(e) => setPol({ ...pol, quiet_end: Number(e.target.value || 0) })}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11.5px]">الإرسال التلقائي للتذكيرات</span>
          <Switch
            checked={pol.auto_send}
            onCheckedChange={(v) => setPol({ ...pol, auto_send: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11.5px]">ملخص يومي للمالك</span>
          <Switch
            checked={pol.daily_digest}
            onCheckedChange={(v) => setPol({ ...pol, daily_digest: v })}
          />
        </div>
        <Button
          size="sm"
          className="w-full h-8 text-[11.5px]"
          onClick={() => mPol.mutate()}
          disabled={mPol.isPending}
        >
          {mPol.isPending ? <Loader2 className="size-3 animate-spin" /> : null} حفظ السياسة
        </Button>
      </Card>

      <Card className="p-2.5 space-y-2">
        <div className="font-bold text-[12px] flex items-center gap-1.5">
          <MessageCircle className="size-3.5 text-success" /> واتساب
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11.5px]">تمكين واتساب</span>
          <Switch
            checked={ch.whatsapp_enabled}
            onCheckedChange={(v) => setCh({ ...ch, whatsapp_enabled: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11.5px]">
            إرسال تلقائي{" "}
            {!av?.whatsapp_auto && (
              <span className="text-[10px] text-muted-foreground">(غير مربوط)</span>
            )}
          </span>
          <Switch
            checked={ch.whatsapp_auto}
            disabled={!av?.whatsapp_auto}
            onCheckedChange={(v) => setCh({ ...ch, whatsapp_auto: v })}
          />
        </div>
        <div>
          <Label className="text-[11px]">رقم المُرسل (اختياري)</Label>
          <Input
            dir="ltr"
            value={ch.whatsapp_from}
            onChange={(e) => setCh({ ...ch, whatsapp_from: e.target.value })}
            placeholder="+9665xxxxxxxx"
          />
        </div>
        <div>
          <Label className="text-[11px]">توقيع الرسائل (اسم الشركة)</Label>
          <Input
            value={ch.signature_name}
            onChange={(e) => setCh({ ...ch, signature_name: e.target.value })}
            placeholder="اسم الشركة"
          />
        </div>
        <Button
          size="sm"
          className="w-full h-8 text-[11.5px]"
          onClick={() => mCh.mutate()}
          disabled={mCh.isPending}
        >
          {mCh.isPending ? <Loader2 className="size-3 animate-spin" /> : null} حفظ القنوات
        </Button>
      </Card>

      <Card className="p-2.5 space-y-2">
        <div className="font-bold text-[12px] flex items-center gap-1.5">
          <Send className="size-3.5 text-primary" /> تليجرام (تنبيهات المالك)
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11.5px]">
            تمكين تليجرام{" "}
            {!av?.telegram && (
              <span className="text-[10px] text-muted-foreground">(غير مربوط)</span>
            )}
          </span>
          <Switch
            checked={ch.telegram_enabled}
            disabled={!av?.telegram}
            onCheckedChange={(v) => setCh({ ...ch, telegram_enabled: v })}
          />
        </div>
        <div className="text-[10.5px] text-muted-foreground leading-relaxed">
          {chatLinked
            ? "المحادثة مربوطة ✅ — سيصلك الملخص اليومي والتنبيهات."
            : "لربط المحادثة: أنشئ كود الربط ثم أرسله للبوت في تليجرام برسالة /start CODE."}
        </div>
        {linkCode && (
          <div className="rounded bg-secondary p-1.5 text-center font-black tabular-nums" dir="ltr">
            /start {linkCode}
          </div>
        )}
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[11px] flex-1"
            onClick={() => mLink.mutate()}
            disabled={mLink.isPending}
          >
            توليد كود الربط
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[11px] flex-1"
            onClick={() => mTest.mutate()}
            disabled={!chatLinked || mTest.isPending}
          >
            رسالة تجريبية
          </Button>
        </div>
      </Card>

      <Card className="p-2.5 space-y-2">
        <div className="font-bold text-[12px]">الرسائل النصية (SMS)</div>
        <div className="flex items-center justify-between">
          <span className="text-[11.5px]">
            تمكين SMS{" "}
            {!av?.sms && <span className="text-[10px] text-muted-foreground">(غير مربوط)</span>}
          </span>
          <Switch
            checked={ch.sms_enabled}
            disabled={!av?.sms}
            onCheckedChange={(v) => setCh({ ...ch, sms_enabled: v })}
          />
        </div>
        <div>
          <Label className="text-[11px]">اسم/رقم المُرسل</Label>
          <Input
            dir="ltr"
            value={ch.sms_from}
            onChange={(e) => setCh({ ...ch, sms_from: e.target.value })}
            placeholder="Daftarak"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-[11.5px]"
          onClick={() => mCh.mutate()}
          disabled={mCh.isPending}
        >
          حفظ
        </Button>
      </Card>
    </div>
  );
}
