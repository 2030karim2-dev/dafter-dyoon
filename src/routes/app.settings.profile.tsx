import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { Avatar } from "@/components/common/Avatar";
import { User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/profile")({ component: ProfilePage });

const COLORS = [
  "oklch(0.7 0.15 245)",
  "oklch(0.7 0.15 165)",
  "oklch(0.7 0.18 25)",
  "oklch(0.7 0.18 305)",
  "oklch(0.72 0.14 80)",
  "oklch(0.65 0.16 200)",
];

function ProfilePage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setDisplayName(data?.display_name ?? "");
      try {
        setColor(
          localStorage.getItem(`daftarak.avatar.color.${user.id}`) ??
            localStorage.getItem("daftarak.avatar.color"),
        );
      } catch {
        /* ignore */
      }
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("user_id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    if (color) localStorage.setItem(`daftarak.avatar.color.${user.id}`, color);
    toast.success("تم الحفظ");
  };

  return (
    <div className="space-y-2.5">
      <PageHeader
        icon={User}
        title="الملف الشخصي"
        subtitle={user?.email ?? ""}
        back="/app/settings"
      />

      <Card className="p-2.5 flex flex-col items-center gap-1.5">
        <Avatar name={displayName || user?.email || "?"} color={color} size="md" />
        <div className="text-[12px] font-semibold">{displayName || "بدون اسم"}</div>
      </Card>

      <Card className="p-2.5 space-y-2.5">
        <div className="space-y-1">
          <Label className="text-[11px]">الاسم المعروض</Label>
          <Input
            className="h-9 text-sm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="اسمك"
            maxLength={60}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">لون الأفاتار</Label>
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ background: c }}
                className={`size-7 rounded-full transition-all ${color === c ? "ring-2 ring-primary ring-offset-2" : ""}`}
                aria-label="اختر اللون"
              />
            ))}
            <button
              onClick={() => setColor(null)}
              className={`size-7 rounded-full bg-secondary text-[10px] font-bold transition-all ${!color ? "ring-2 ring-primary ring-offset-2" : ""}`}
            >
              تلقائي
            </button>
          </div>
        </div>
        <Button
          size="sm"
          onClick={save}
          disabled={busy}
          className="w-full h-8 text-[12px] bg-gradient-primary text-primary-foreground"
        >
          حفظ
        </Button>
      </Card>
    </div>
  );
}
