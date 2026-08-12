import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useTheme, ACCENTS, FONT_SIZES, type AccentId, type FontSizeId } from "@/lib/theme";
import { PageHeader } from "@/components/common/PageHeader";
import { Palette, Sun, Moon, Monitor } from "lucide-react";

export const Route = createFileRoute("/app/settings/appearance")({ component: AppearancePage });

const ACCENT_LIST = Object.entries(ACCENTS).map(([id, a]) => ({
  id: id as AccentId,
  name: a.name,
  swatch: a.swatch,
}));
const SIZE_LIST = Object.entries(FONT_SIZES).map(([id, s]) => ({
  id: id as FontSizeId,
  label: s.label,
  px: s.px,
}));

function AppearancePage() {
  // All appearance settings live in ThemeProvider — applied globally on every
  // page and persisted automatically. This page only edits the context.
  const { theme, set, accent, setAccent, fontSize, setFontSize } = useTheme();

  return (
    <div className="space-y-2.5">
      <PageHeader
        icon={Palette}
        title="المظهر"
        subtitle="خصّص ألوان وحجم خط التطبيق"
        back="/app/settings"
      />

      <Card className="p-2.5 space-y-2">
        <Label className="text-[11px]">السمة</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "light", label: "فاتح", icon: Sun },
            { id: "dark", label: "داكن", icon: Moon },
            { id: "system", label: "تلقائي", icon: Monitor },
          ].map((t) => {
            const Icon = t.icon;
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => set(t.id as "light" | "dark" | "system")}
                className={`flex flex-col items-center gap-1 py-1.5 rounded-md border transition-all ${active ? "border-primary bg-primary/5" : "border-input bg-card"}`}
              >
                <Icon className="size-4" />
                <span className="text-[11px] font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-2.5 space-y-2">
        <Label className="text-[11px]">اللون الأساسي</Label>
        <div className="flex flex-wrap gap-1.5">
          {ACCENT_LIST.map((a) => (
            <button
              key={a.id}
              onClick={() => setAccent(a.id)}
              style={{ background: a.swatch }}
              className={`size-7 rounded-md transition-all ${accent === a.id ? "ring-2 ring-primary ring-offset-2 scale-110" : ""}`}
              aria-label={a.name}
              title={a.name}
            />
          ))}
        </div>
      </Card>

      <Card className="p-2.5 space-y-2">
        <Label className="text-[11px]">حجم الخط</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {SIZE_LIST.map((s) => (
            <button
              key={s.id}
              onClick={() => setFontSize(s.id)}
              className={`py-1.5 rounded-md font-semibold transition-all ${fontSize === s.id ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"}`}
              style={{ fontSize: `${(s.px ?? 12.5) * 0.92}px` }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
