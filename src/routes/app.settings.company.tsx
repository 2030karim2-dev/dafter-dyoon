import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChevronRight, Building2, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/company")({ component: CompanyPage });

interface Profile {
  name: string;
  address: string;
  phone: string;
  email: string;
  tax_number: string;
  notes: string;
  logo_path: string | null;
}

const empty: Profile = {
  name: "",
  address: "",
  phone: "",
  email: "",
  tax_number: "",
  notes: "",
  logo_path: null,
};

function CompanyPage() {
  const { user } = useAuth();
  const [p, setP] = useState<Profile>(empty);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("company_profile")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data)
        setP({
          name: data.name ?? "",
          address: data.address ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          tax_number: data.tax_number ?? "",
          notes: data.notes ?? "",
          logo_path: data.logo_path ?? null,
        });
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!p.logo_path) {
      setLogoUrl(null);
      return;
    }
    let cancel = false;
    (async () => {
      const { data } = await supabase.storage.from("receipts").createSignedUrl(p.logo_path!, 3600);
      if (!cancel) setLogoUrl(data?.signedUrl ?? null);
    })();
    return () => {
      cancel = true;
    };
  }, [p.logo_path]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((s) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("company_profile").upsert(
      {
        user_id: user.id,
        name: p.name.trim() || null,
        address: p.address.trim() || null,
        phone: p.phone.trim() || null,
        email: p.email.trim() || null,
        tax_number: p.tax_number.trim() || null,
        notes: p.notes.trim() || null,
        logo_path: p.logo_path,
      } as never,
      { onConflict: "user_id" },
    );
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("تم الحفظ");
  };

  const uploadLogo = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("ملف صورة فقط");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("الحد الأقصى 2MB");
      return;
    }
    setBusy(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/company/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file, { upsert: true });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    set("logo_path", path);
    toast.success("تم رفع الشعار — اضغط حفظ");
  };

  const removeLogo = () => set("logo_path", null);

  if (loading)
    return <div className="p-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>;

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <Link
        to="/app/settings"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="size-3.5" /> الإعدادات
      </Link>

      <Card className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="size-4" />
          </div>
          <div>
            <div className="font-bold text-sm">بيانات المنشأة</div>
            <div className="text-[11px] text-muted-foreground">تظهر في كشوف الحساب والتقارير</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="size-16 rounded-lg bg-secondary ring-1 ring-border overflow-hidden flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="size-full object-contain" />
            ) : (
              <Building2 className="size-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 flex gap-2">
            <label className="flex-1">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
              />
              <span className="inline-flex w-full justify-center items-center gap-1.5 cursor-pointer rounded-md border bg-secondary px-2 py-1.5 text-xs hover:bg-secondary/80">
                <Upload className="size-3.5" /> رفع شعار
              </span>
            </label>
            {p.logo_path && (
              <button
                type="button"
                onClick={removeLogo}
                className="rounded-md border bg-danger-soft text-danger px-2 py-1.5 text-xs"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <Field label="اسم المنشأة">
          <Input value={p.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />
        </Field>
        <Field label="رقم الجوال">
          <Input
            value={p.phone}
            onChange={(e) => set("phone", e.target.value)}
            dir="ltr"
            maxLength={30}
          />
        </Field>
        <Field label="البريد الإلكتروني">
          <Input
            type="email"
            value={p.email}
            onChange={(e) => set("email", e.target.value)}
            dir="ltr"
            maxLength={120}
          />
        </Field>
        <Field label="العنوان">
          <Input
            value={p.address}
            onChange={(e) => set("address", e.target.value)}
            maxLength={200}
          />
        </Field>
        <Field label="الرقم الضريبي">
          <Input
            value={p.tax_number}
            onChange={(e) => set("tax_number", e.target.value)}
            dir="ltr"
            maxLength={50}
          />
        </Field>
        <Field label="ملاحظات على الكشف">
          <Textarea
            value={p.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="شروط، رسالة شكر…"
          />
        </Field>

        <Button
          onClick={save}
          disabled={busy}
          className="w-full bg-gradient-primary text-primary-foreground"
        >
          {busy ? "جارٍ الحفظ…" : "حفظ"}
        </Button>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
