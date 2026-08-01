import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, TrendingUp, Bell, Users, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Currency { id: string; name: string; symbol: string; is_base: boolean }

const SLIDES = [
  {
    icon: Wallet,
    title: "أهلاً بك في دفترك",
    desc: "منصتك المتخصصة في متابعة الديون والعملاء والتذكير بالاستحقاقات.",
  },
  {
    icon: TrendingUp,
    title: "تتبع كل ما لك وما عليك",
    desc: "سجّل المعاملات بسهولة مع أكثر من عملة، واطّلع على رصيد كل شخص لحظياً.",
  },
  {
    icon: Users,
    title: "تابع عملاءك",
    desc: "كشوف حسابات احترافية، تقييم للعملاء، ومشاركة فورية عبر واتساب.",
  },
  {
    icon: Bell,
    title: "تذكيرات وأمان",
    desc: "تذكيرات لاسترداد ديونك، قفل سري، ونسخ احتياطي سحابي دائم.",
  },
] as const;

interface Props {
  onDone: () => void;
}

export function OnboardingFlow({ onDone }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [baseId, setBaseId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("currencies").select("id,name,symbol,is_base").eq("user_id", user.id);
      const list = (data ?? []) as Currency[];
      setCurrencies(list);
      const base = list.find((c) => c.is_base);
      setBaseId(base?.id ?? list[0]?.id ?? "");
    })();
  }, [user]);

  const finish = async () => {
    if (!user) return;
    setBusy(true);
    try {
      // Set base currency
      if (baseId) {
        await supabase.from("currencies").update({ is_base: false }).eq("user_id", user.id);
        await supabase.from("currencies").update({ is_base: true }).eq("id", baseId);
      }
      // Save name + mark onboarded
      await supabase.from("profiles").upsert({
        user_id: user.id,
        display_name: name.trim() || null,
        onboarded: true,
      }, { onConflict: "user_id" });
      toast.success("جاهز للانطلاق! 🎉");
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "خطأ";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const isLast = step === SLIDES.length;
  const canNext = !isLast || (baseId && true);

  return (
    <div className="fixed inset-0 z-[90] bg-gradient-hero text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {!isLast ? (
          <SlideView slide={SLIDES[step]} idx={step} key={step} />
        ) : (
          <div className="w-full max-w-sm space-y-5 animate-in fade-in slide-in-from-right-6 duration-500">
            <div className="size-20 mx-auto rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shadow-glow">
              <Sparkles className="size-9" />
            </div>
            <div>
              <h2 className="text-2xl font-black">إعداد سريع</h2>
              <p className="text-white/85 text-sm mt-1">خطوتان فقط لنبدأ</p>
            </div>
            <div className="space-y-2 text-right">
              <label className="text-sm font-semibold">اسمك المعروض (اختياري)</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: محمد"
                className="bg-white/15 border-white/20 text-white placeholder:text-white/60"
                maxLength={60}
              />
            </div>
            <div className="space-y-2 text-right">
              <label className="text-sm font-semibold">العملة الأساسية</label>
              <div className="grid grid-cols-3 gap-2">
                {currencies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setBaseId(c.id)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      baseId === c.id ? "bg-white text-primary border-white shadow-glow" : "border-white/30 bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    <div className="font-bold">{c.name}</div>
                    {c.symbol && <div className="text-xs opacity-70">{c.symbol}</div>}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-white/70">يمكنك تغييرها لاحقاً من الإعدادات</p>
            </div>
          </div>
        )}
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mb-4">
        {Array.from({ length: SLIDES.length + 1 }).map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-white" : "w-1.5 bg-white/40"}`} />
        ))}
      </div>

      {/* Footer actions */}
      <div className="px-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] flex items-center gap-2">
        {!isLast && (
          <Button
            variant="ghost"
            onClick={() => { setStep(SLIDES.length); }}
            className="text-white/85 hover:text-white hover:bg-white/10"
          >
            تخطّي
          </Button>
        )}
        <div className="flex-1" />
        {step > 0 && !isLast && (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} className="text-white hover:bg-white/10">
            <ChevronRight className="size-5" />
          </Button>
        )}
        {!isLast ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            className="bg-white text-primary hover:bg-white/90 shadow-glow gap-1"
          >
            التالي <ChevronLeft className="size-4" />
          </Button>
        ) : (
          <Button
            disabled={busy || !canNext}
            onClick={finish}
            className="bg-white text-primary hover:bg-white/90 shadow-glow"
          >
            {busy ? "..." : "ابدأ الآن"}
          </Button>
        )}
      </div>
    </div>
  );
}

function SlideView({ slide, idx }: { slide: typeof SLIDES[number]; idx: number }) {
  const Icon = slide.icon;
  return (
    <div key={idx} className="max-w-sm animate-in fade-in slide-in-from-right-6 duration-500">
      <div className="size-24 mx-auto rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center mb-6 shadow-glow">
        <Icon className="size-12" />
      </div>
      <h2 className="text-2xl font-black mb-2">{slide.title}</h2>
      <p className="text-white/85 leading-relaxed">{slide.desc}</p>
    </div>
  );
}
