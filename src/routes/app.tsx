import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Wallet, Loader2, Bell, Search, Moon, Sun } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { BadgeCount } from "@/components/common/BadgeCount";
import { GlobalSearchDialog } from "@/components/GlobalSearchDialog";
import { useTheme } from "@/lib/theme";
import { pollAndNotify } from "@/lib/notifications";
import { usePendingAlerts } from "@/hooks/usePendingAlerts";
import { syncRemindersFn } from "@/lib/jobs.functions";
import { registerServiceWorker } from "@/lib/push";
import { AlertCenter } from "@/components/alerts/AlertCenter";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { count: pending } = usePendingAlerts();
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, set: setTheme } = useTheme();
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    // Defer heavy backend sync until the browser is idle so navigation feels instant.
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: object) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    let handle: number;
    let usedIdle = false;
    const cb = () => {
      syncRemindersFn().catch(() => null);
      pollAndNotify(user.id);
    };
    if (w.requestIdleCallback) {
      usedIdle = true;
      handle = w.requestIdleCallback(cb, { timeout: 2000 });
    } else {
      handle = window.setTimeout(cb, 1200);
    }
    return () => {
      if (usedIdle) w.cancelIdleCallback?.(handle);
      else clearTimeout(handle);
    };
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <header className="bg-gradient-hero text-white sticky top-0 z-30 shadow-elevated">
        <div className="max-w-3xl mx-auto px-2.5 h-10 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-1.5 font-black text-[13px]">
            <div className="size-6 rounded-md bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/15">
              <Wallet className="size-3" />
            </div>
            دفترك
          </Link>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
              aria-label="بحث"
            >
              <Search className="size-3.5" />
            </button>
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
              aria-label="تبديل المظهر"
            >
              {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </button>
            <Link
              to="/app/notifications"
              className="relative p-1.5 rounded-md hover:bg-white/10 transition-colors"
              aria-label="الإشعارات"
            >
              <Bell className="size-3.5" />
              {pending > 0 && (
                <span className="absolute top-0 right-0">
                  <BadgeCount count={pending} tone="danger" />
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-2.5 py-2.5">
        <Outlet />
      </main>

      <AlertCenter userId={user.id} />

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <BottomNav />
    </div>
  );
}
