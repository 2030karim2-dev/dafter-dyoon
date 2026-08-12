import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wallet, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({ component: AuthPage });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthPage() {
  const { user, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    if (!loading && user && !recovery) navigate({ to: "/app" });
  }, [user, loading, recovery, navigate]);

  // Supabase fires PASSWORD_RECOVERY when the user lands via the reset email link.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handle = async (mode: "in" | "up") => {
    if (!EMAIL_RE.test(email) || password.length < 6) {
      toast.error("أدخل بريداً صحيحاً وكلمة مرور لا تقل عن 6 أحرف");
      return;
    }
    setBusy(true);
    const { error } = mode === "in" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (error) toast.error(error);
    else if (mode === "up")
      toast.success("تم إنشاء الحساب! إن طُلب تأكيد البريد فتفقد صندوق واردك ثم سجّل الدخول.");
    else navigate({ to: "/app" });
  };

  const handleResetRequest = async () => {
    if (!EMAIL_RE.test(email)) {
      toast.error("أدخل بريدك الإلكتروني أولاً");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setBusy(false);
    if (error) toast.error("تعذّر إرسال الرابط، حاول لاحقاً");
    else toast.success("أرسلنا رابط إعادة التعيين إلى بريدك");
  };

  const handleSaveNewPassword = async () => {
    if (newPw.length < 6) {
      toast.error("كلمة المرور يجب ألا تقل عن 6 أحرف");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setBusy(false);
    if (error) {
      toast.error("تعذّر تحديث كلمة المرور، أعد المحاولة");
      return;
    }
    toast.success("تم تحديث كلمة المرور بنجاح");
    setRecovery(false);
    navigate({ to: "/app" });
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/app`,
    });
    if (result.error) {
      setBusy(false);
      toast.error("فشل تسجيل الدخول بحساب جوجل");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/app" });
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="flex items-center gap-2 text-white/90 hover:text-white mb-6 text-sm"
        >
          <ArrowLeft className="size-4 rotate-180" /> العودة للرئيسية
        </Link>

        <div className="text-center mb-6">
          <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur mb-3 shadow-glow">
            <Wallet className="size-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">مرحباً بك في دفترك</h1>
          <p className="text-white/80 text-sm mt-1">إدارة ومتابعة ديونك بكل احترافية</p>
        </div>

        <Card className="p-6 shadow-elevated">
          {recovery ? (
            <div className="space-y-3">
              <h2 className="font-bold text-center">تعيين كلمة مرور جديدة</h2>
              <p className="text-xs text-muted-foreground text-center">
                وصلت عبر رابط إعادة التعيين — اختر كلمة مرور جديدة لحسابك.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="newpw">كلمة المرور الجديدة</Label>
                <Input
                  id="newpw"
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button
                className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
                disabled={busy}
                onClick={handleSaveNewPassword}
              >
                {busy ? "..." : "حفظ كلمة المرور"}
              </Button>
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full mb-4 h-11 font-semibold"
                disabled={busy}
                onClick={handleGoogle}
              >
                <GoogleIcon /> المتابعة باستخدام Google
              </Button>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase">
                  <span className="bg-card px-2 text-muted-foreground">أو</span>
                </div>
              </div>

              <Tabs defaultValue="in" className="w-full">
                <TabsList className="grid grid-cols-2 w-full mb-4">
                  <TabsTrigger value="in">تسجيل الدخول</TabsTrigger>
                  <TabsTrigger value="up">إنشاء حساب</TabsTrigger>
                </TabsList>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input
                      id="email"
                      type="email"
                      dir="ltr"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pw">كلمة المرور</Label>
                    <Input
                      id="pw"
                      type="password"
                      dir="ltr"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <TabsContent value="in" className="mt-4 space-y-2">
                  <Button
                    className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
                    disabled={busy}
                    onClick={() => handle("in")}
                  >
                    {busy ? "..." : "تسجيل الدخول"}
                  </Button>
                  <button
                    type="button"
                    onClick={handleResetRequest}
                    disabled={busy}
                    className="w-full text-center text-[11px] text-muted-foreground hover:text-primary transition-colors"
                  >
                    نسيت كلمة المرور؟ أرسل رابط إعادة التعيين
                  </button>
                </TabsContent>
                <TabsContent value="up" className="mt-4">
                  <Button
                    className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
                    disabled={busy}
                    onClick={() => handle("up")}
                  >
                    {busy ? "..." : "إنشاء حساب جديد"}
                  </Button>
                </TabsContent>
              </Tabs>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.7 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C40.5 35.5 44 30.2 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
