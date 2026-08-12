import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, TrendingDown, Users, Shield, BarChart3, Cloud } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="bg-gradient-hero text-white">
        <nav className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="size-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Wallet className="size-5" />
            </div>
            دفترك
          </div>
          <Link to="/auth">
            <Button variant="secondary" size="sm">
              دخول
            </Button>
          </Link>
        </nav>
        <div className="max-w-6xl mx-auto px-4 pt-10 pb-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-black leading-tight">
            إدارة ومتابعة الديون <br /> بطريقة احترافية
          </h1>
          <p className="mt-4 text-white/85 text-base sm:text-lg max-w-xl mx-auto">
            تتبع كل ما لك وما عليك، نظّم عملاءك ومورديك، وراقب أرصدتك بدقة عالية في مكان واحد.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 shadow-glow">
                ابدأ مجاناً
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">
          كل ما تحتاجه لإدارة أموالك
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: TrendingUp,
              t: "تتبع له (دائن)",
              d: "سجّل المبالغ المستحقة لك من العملاء بسهولة وبعدة عملات.",
              c: "text-success",
            },
            {
              icon: TrendingDown,
              t: "تتبع عليه (مدين)",
              d: "اعرف ما عليك للموردين والأشخاص في كل لحظة.",
              c: "text-danger",
            },
            {
              icon: Users,
              t: "إدارة الأشخاص",
              d: "عملاء، موردين، ديون عامة - كل شخص في مكانه.",
              c: "text-primary",
            },
            {
              icon: BarChart3,
              t: "تقارير دقيقة",
              d: "ملخصات فورية للأرصدة بعملاتك المختلفة.",
              c: "text-primary",
            },
            {
              icon: Cloud,
              t: "مزامنة سحابية",
              d: "بياناتك محفوظة وآمنة ومتوفرة من أي جهاز.",
              c: "text-primary",
            },
            {
              icon: Shield,
              t: "خصوصية تامة",
              d: "بياناتك محمية ولا يمكن لأحد آخر الوصول إليها.",
              c: "text-primary",
            },
          ].map((f, i) => (
            <div
              key={i}
              className="bg-card border rounded-2xl p-5 shadow-card hover:shadow-elevated transition-shadow"
            >
              <div
                className={`size-11 rounded-xl bg-secondary flex items-center justify-center mb-3 ${f.c}`}
              >
                <f.icon className="size-5" />
              </div>
              <h3 className="font-bold mb-1">{f.t}</h3>
              <p className="text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow">
              أنشئ حسابك الآن
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} دفترك. كل الحقوق محفوظة.
      </footer>
    </div>
  );
}
