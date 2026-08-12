import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { Info, Wallet, Heart, Phone, Mail, User, MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/about")({ component: AboutPage });

const DEV = {
  name: "عبدالكريم الجعفري",
  phone1: "00967779816860",
  phone2: "00967782644460",
  email: "alkarime0@gmail.com",
};

function AboutPage() {
  const copy = (v: string, label: string) => {
    navigator.clipboard?.writeText(v);
    toast.success(`تم نسخ ${label}`);
  };
  const waLink = (p: string) => `https://wa.me/${p.replace(/^00/, "")}`;

  return (
    <div className="space-y-2.5">
      <PageHeader icon={Info} title="حول التطبيق" back="/app/settings" />

      <Card className="p-3 flex flex-col items-center gap-1.5 text-center">
        <div className="size-12 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
          <Wallet className="size-6" />
        </div>
        <div>
          <div className="font-black text-[14px]">دفترك</div>
          <div className="text-[10px] text-muted-foreground">إصدار 1.0.0</div>
        </div>
        <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
          تطبيق محاسبي احترافي لإدارة الديون والمصاريف ومتابعة العملاء بسهولة وأمان.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="bg-gradient-primary text-primary-foreground px-3 py-2 flex items-center gap-2">
          <User className="size-4" />
          <div className="font-bold text-[12px]">المطور</div>
        </div>
        <div className="p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <div className="size-10 rounded-full bg-secondary text-primary flex items-center justify-center font-black text-[14px] ring-1 ring-border">
              ع
            </div>
            <div className="flex-1 text-right">
              <div className="font-bold text-[13px] leading-tight">{DEV.name}</div>
              <div className="text-[10px] text-muted-foreground">مطوّر ومصمم تطبيقات</div>
            </div>
          </div>

          <div className="divide-y divide-border/50">
            <ContactRow
              icon={Phone}
              label="الجوال الأول"
              value={DEV.phone1}
              color="text-primary"
              onCopy={() => copy(DEV.phone1, "الرقم")}
              actions={[
                {
                  href: `tel:+${DEV.phone1.replace(/^00/, "")}`,
                  icon: Phone,
                  label: "اتصال",
                  className: "bg-primary/10 text-primary",
                },
                {
                  href: waLink(DEV.phone1),
                  icon: MessageCircle,
                  label: "واتساب",
                  className: "bg-success/10 text-success",
                  external: true,
                },
              ]}
            />
            <ContactRow
              icon={Phone}
              label="الجوال الثاني"
              value={DEV.phone2}
              color="text-primary"
              onCopy={() => copy(DEV.phone2, "الرقم")}
              actions={[
                {
                  href: `tel:+${DEV.phone2.replace(/^00/, "")}`,
                  icon: Phone,
                  label: "اتصال",
                  className: "bg-primary/10 text-primary",
                },
                {
                  href: waLink(DEV.phone2),
                  icon: MessageCircle,
                  label: "واتساب",
                  className: "bg-success/10 text-success",
                  external: true,
                },
              ]}
            />
            <ContactRow
              icon={Mail}
              label="البريد الإلكتروني"
              value={DEV.email}
              color="text-danger"
              onCopy={() => copy(DEV.email, "البريد")}
              actions={[
                {
                  href: `mailto:${DEV.email}`,
                  icon: Mail,
                  label: "مراسلة",
                  className: "bg-danger/10 text-danger",
                },
              ]}
            />
          </div>
        </div>
      </Card>

      <Card className="p-2.5 space-y-1 text-[10px] text-muted-foreground leading-relaxed">
        <p className="font-semibold text-foreground text-[11px] flex items-center gap-1">
          <Heart className="size-3 text-danger" /> الخصوصية والأمان
        </p>
        <p>بياناتك مشفّرة ومحفوظة بأمان. لا نشارك أو نبيع أي معلومات شخصية.</p>
        <p>يمكنك تصدير أو حذف بياناتك في أي وقت من إعدادات البيانات.</p>
      </Card>

      <p className="text-center text-[10px] text-muted-foreground">
        © {new Date().getFullYear()} دفترك — تطوير {DEV.name}. جميع الحقوق محفوظة.
      </p>
    </div>
  );
}

type Action = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className: string;
  external?: boolean;
};

function ContactRow({
  icon: Icon,
  label,
  value,
  color,
  onCopy,
  actions,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  onCopy: () => void;
  actions: Action[];
}) {
  return (
    <div className="py-2 flex items-center gap-2">
      <div
        className={`size-8 rounded-md bg-secondary ${color} flex items-center justify-center ring-1 ring-border shrink-0`}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0 text-right">
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div dir="ltr" className="font-mono font-semibold text-[12px] truncate text-right">
          {value}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {actions.map((a, i) => (
          <a
            key={i}
            href={a.href}
            {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            aria-label={a.label}
            className={`size-7 rounded-md ${a.className} flex items-center justify-center hover:opacity-80 transition`}
          >
            <a.icon className="size-3.5" />
          </a>
        ))}
        <button
          type="button"
          onClick={onCopy}
          aria-label="نسخ"
          className="size-7 rounded-md bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center"
        >
          <Copy className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
