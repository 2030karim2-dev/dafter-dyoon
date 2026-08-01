import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, BarChart3, Settings, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BadgeCount } from "@/components/common/BadgeCount";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Users;
  match: (p: string) => boolean;
  badgeKey?: "reminders";
}

const SETTINGS_PREFIXES = [
  "/app/settings", "/app/currencies", "/app/reminders", "/app/recurring",
];

const items: NavItem[] = [
  { to: "/app", label: "الديون", icon: Users, match: (p) => p === "/app" || p === "/app/" },
  { to: "/app/followup", label: "المتابعة", icon: BellRing, match: (p) => p.startsWith("/app/followup"), badgeKey: "reminders" },
  { to: "/app/reports", label: "التقارير", icon: BarChart3, match: (p) => p.startsWith("/app/reports") },
  { to: "/app/settings", label: "الإعدادات", icon: Settings, match: (p) => SETTINGS_PREFIXES.some((x) => p.startsWith(x)) },
];

export function BottomNav() {
  const loc = useLocation();
  const path = loc.pathname;
  const { user } = useAuth();
  const [pendingReminders, setPendingReminders] = useState(0);

  useEffect(() => {
    if (!user) return;
    const today = new Date(); today.setHours(23, 59, 59, 999);
    supabase.from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("is_done", false)
      .lte("due_date", today.toISOString())
      .then(({ count }) => setPendingReminders(count ?? 0));
  }, [user, path]);

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur border-t z-30 pb-[env(safe-area-inset-bottom)]" aria-label="التنقل الرئيسي">
      <div className="max-w-3xl mx-auto grid grid-cols-4 h-12">
        {items.map((it) => {
          const active = it.match(path);
          const Icon = it.icon;
          const showBadge = (it.badgeKey === "reminders" || it.to === "/app/settings") && pendingReminders > 0;
          return (
            <Link
              key={it.to}
              to={it.to}
              preload="viewport"
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors active:scale-95 ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              aria-current={active ? "page" : undefined}
            >
              <div className={`size-7 rounded-md flex items-center justify-center transition-all relative ${active ? "bg-gradient-primary text-primary-foreground shadow-glow" : ""}`}>
                <Icon className="size-[15px]" />
                {showBadge && (
                  <span className="absolute -top-1 -right-1">
                    <BadgeCount count={pendingReminders} tone="danger" />
                  </span>
                )}
              </div>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
