import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { markLocked } from "@/lib/pin";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SettingsRow } from "@/components/common/SettingsRow";
import { SettingsGroup } from "@/components/common/SettingsGroup";
import { Avatar } from "@/components/common/Avatar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  User, ShieldCheck, Bell, Palette, Database, Info,
  Coins, Repeat, Archive, Wallet, LogOut, Moon, Sun, Radio,
} from "lucide-react";

export const Route = createFileRoute("/app/settings/")({ component: SettingsPage });

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      setDisplayName(data?.display_name ?? "");
    })();
    try { setColor(localStorage.getItem("daftarak.avatar.color")); } catch {}
  }, [user]);

  const handleSignOut = async () => {
    markLocked();
    await signOut();
  };

  return (
    <div className="space-y-2 animate-in fade-in duration-300">
      {/* Profile card */}
      <Card className="p-1.5 flex items-center gap-2">
        <Avatar name={displayName || user?.email || "?"} color={color} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[11.5px] truncate leading-tight">{displayName || "ضيف"}</div>
          <div className="text-[9.5px] text-muted-foreground truncate">{user?.email}</div>
        </div>
      </Card>

      {/* Account */}
      <SettingsGroup title="الحساب">
        <SettingsRow to="/app/settings/profile" icon={User} label="الملف الشخصي" desc="الاسم والصورة" tone="primary" />
        <SettingsRow to="/app/settings/company" icon={Wallet} label="بيانات المنشأة" desc="الشعار والعنوان للكشوف" tone="accent" />
        <SettingsRow to="/app/settings/security" icon={ShieldCheck} label="الأمان والخصوصية" desc="قفل التطبيق والبصمة" tone="success" />
        <SettingsRow to="/app/settings/notifications" icon={Bell} label="الإشعارات" desc="تذكيرات الاستحقاقات والديون" tone="warning" />
        <SettingsRow to="/app/settings/channels" icon={Radio} label="قنوات التذكير" desc="واتساب، تليجرام، SMS وسياسة المتابعة" tone="success" />

      </SettingsGroup>

      {/* Appearance */}
      <SettingsGroup title="المظهر">
        <SettingsRow
          to="/app/settings/appearance"
          icon={Palette}
          label="المظهر والألوان"
          desc="السمة، اللون، حجم الخط"
          tone="accent"
        />
        <Card className="border-0 shadow-none p-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="size-6 rounded-md bg-secondary text-primary flex items-center justify-center ring-1 ring-border">
              {theme === "dark" ? <Moon className="size-3" /> : <Sun className="size-3" />}
            </div>
            <div>
              <div className="font-semibold text-[11.5px] leading-tight">الوضع الداكن</div>
              <div className="text-[9.5px] text-muted-foreground">تبديل سريع</div>
            </div>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggle} />
        </Card>
      </SettingsGroup>

      {/* Debts module */}
      <SettingsGroup title="الديون">
        <SettingsRow to="/app/currencies" icon={Coins} label="العملات" desc="إدارة العملات والأساسية" tone="primary" />
        <SettingsRow to="/app/exchange-rates" icon={Coins} label="أسعار الصرف" desc="تحديث يومي + سجل" tone="accent" />
        <SettingsRow to="/app/opening-balances" icon={Wallet} label="الأرصدة الافتتاحية" desc="رصيد بدء لكل عميل وعملة" tone="success" />
        <SettingsRow to="/app/reminders" icon={Bell} label="التذكيرات" desc="مواعيد الاسترداد" tone="warning" />
        <SettingsRow to="/app/recurring" icon={Repeat} label="المعاملات المتكررة" desc="رواتب، إيجارات، اشتراكات" tone="success" />
        <SettingsRow to="/app/archive" icon={Archive} label="الأرشيف" desc="الأشخاص المؤرشفون" tone="muted" />
      </SettingsGroup>

      {/* Data */}
      <SettingsGroup title="البيانات">
        <SettingsRow to="/app/settings/data" icon={Database} label="النسخ الاحتياطي" desc="السحابة، تصدير، استيراد" tone="success" />
        <SettingsRow to="/app/activity" icon={Info} label="سجل النشاط" desc="آخر العمليات" tone="muted" />
      </SettingsGroup>

      {/* About */}
      <SettingsGroup title="عام">
        <SettingsRow to="/app/settings/about" icon={Info} label="حول التطبيق" desc="الإصدار والخصوصية" tone="muted" />
      </SettingsGroup>

      {/* Sign out */}
      <Card className="p-1.5">
        <SettingsRow icon={LogOut} label="تسجيل الخروج" onClick={() => setConfirmOut(true)} danger />
      </Card>

      <p className="text-center text-[11px] text-muted-foreground pt-2">دفترك • إصدار 1.0.0</p>

      <ConfirmDialog
        open={confirmOut}
        onOpenChange={setConfirmOut}
        title="تسجيل الخروج؟"
        description="ستحتاج لتسجيل الدخول مجدداً."
        confirmLabel="خروج"
        destructive
        onConfirm={handleSignOut}
      />
    </div>
  );
}
