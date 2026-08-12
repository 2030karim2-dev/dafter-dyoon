import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/lib/auth";
import { readNotifPref, writeNotifPref } from "@/lib/notifications";
import { Bell, BellRing, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (!user) return;
    setEnabled(readNotifPref(user.id, "enabled") === "1");
    setReminderTime(readNotifPref(user.id, "time") ?? "09:00");
    try {
      if (typeof Notification !== "undefined") setPermission(Notification.permission);
    } catch {
      /* ignore */
    }
  }, [user]);

  const requestPerm = async () => {
    if (typeof Notification === "undefined") return toast.error("متصفحك لا يدعم الإشعارات");
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") {
      toggle(true);
      new Notification("دفترك", { body: "تم تفعيل الإشعارات بنجاح ✅" });
    } else {
      toast.error("لم يتم منح إذن الإشعارات");
    }
  };

  const toggle = (v: boolean) => {
    setEnabled(v);
    if (user) writeNotifPref(user.id, "enabled", v ? "1" : "0");
  };

  const saveTime = (t: string) => {
    setReminderTime(t);
    if (user) writeNotifPref(user.id, "time", t);
  };

  return (
    <div className="space-y-2.5">
      <PageHeader
        icon={Bell}
        title="الإشعارات"
        subtitle="تذكيرات الاستحقاقات والديون"
        back="/app/settings"
      />

      <Card className="p-2.5 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-secondary text-primary flex items-center justify-center ring-1 ring-border">
            <BellRing className="size-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[12px] leading-tight">تنبيهات المتصفح</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {permission === "granted"
                ? "مسموح"
                : permission === "denied"
                  ? "مرفوض من المتصفح"
                  : "بحاجة لإذن"}
            </div>
          </div>
          {permission === "granted" ? (
            <Switch checked={enabled} onCheckedChange={toggle} />
          ) : (
            <Button
              size="sm"
              className="h-7 text-[11px] px-2"
              onClick={requestPerm}
              disabled={permission === "denied"}
            >
              طلب الإذن
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-secondary text-primary flex items-center justify-center ring-1 ring-border">
            <Clock className="size-3.5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[12px] leading-tight">وقت التذكير اليومي</div>
            <div className="text-[10px] text-muted-foreground">سيتم فحص التذكيرات في هذا الوقت</div>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">الوقت</Label>
          <input
            type="time"
            value={reminderTime}
            onChange={(e) => saveTime(e.target.value)}
            className="w-full bg-secondary border border-input rounded-md px-2.5 py-1.5 text-[13px]"
            dir="ltr"
          />
        </div>
      </Card>

      <p className="text-[10px] text-muted-foreground text-center px-4">
        ملاحظة: تعتمد التنبيهات على بقاء التطبيق مفتوحاً في المتصفح.
      </p>
    </div>
  );
}
