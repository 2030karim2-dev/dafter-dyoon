import { Link, useLocation } from "@tanstack/react-router";
import { Users, Sun, BarChart3, Settings, BellRing, Wallet } from "lucide-react";
import { usePendingAlerts } from "@/hooks/usePendingAlerts";
import { BadgeCount } from "@/components/common/BadgeCount";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Users;
  match: (p: string) => boolean;
  badgeKey?: "reminders";
}

const SETTINGS_PREFIXES = ["/app/settings", "/app/currencies", "/app/reminders", "/app/recurring"];

const items: NavItem[] = [
  { to: "/app", label: "الديون", icon: Users, match: (p) => p === "/app" || p === "/app/" },
  { to: "/app/today", label: "اليوم", icon: Sun, match: (p) => p.startsWith("/app/today") },
  {
    to: "/app/followup",
    label: "المتابعة",
    icon: BellRing,
    match: (p) => p.startsWith("/app/followup"),
    badgeKey: "reminders",
  },
  {
    to: "/app/reports",
    label: "التقارير",
    icon: BarChart3,
    match: (p) => p.startsWith("/app/reports"),
  },
  {
    to: "/app/settings",
    label: "الإعدادات",
    icon: Settings,
    match: (p) => SETTINGS_PREFIXES.some((x) => p.startsWith(x)),
  },
];

export function DesktopSidebar() {
  const loc = useLocation();
  const path = loc.pathname;
  const { count: pendingReminders } = usePendingAlerts();

  return (
    <aside className="hidden lg:flex w-64 flex-col border-l bg-card/95 backdrop-blur sticky top-0 h-screen">
      <div className="p-4 border-b">
        <Link to="/app" className="flex items-center gap-2.5 font-black text-lg tracking-tight">
          <div className="size-9 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
            <Wallet className="size-5" />
          </div>
          دفترك
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="التنقل الرئيسي">
        {items.map((it) => {
          const active = it.match(path);
          const Icon = it.icon;
          const showBadge = it.badgeKey === "reminders" && pendingReminders > 0;
          return (
            <Link
              key={it.to}
              to={it.to}
              preload="viewport"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <div className={`size-9 rounded-lg flex items-center justify-center relative transition-all ${
                active ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"
              }`}>
                <Icon className="size-4" />
                {showBadge && (
                  <span className="absolute -top-1 -left-1">
                    <BadgeCount count={pendingReminders} tone="danger" />
                  </span>
                )}
              </div>
              <span className="font-semibold">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t">
        <div className="text-[10px] text-muted-foreground text-center">
          دفترك © {new Date().getFullYear()}
        </div>
      </div>
    </aside>
  );
}
