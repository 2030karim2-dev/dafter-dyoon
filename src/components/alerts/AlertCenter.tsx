import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, BellRing, X, Volume2, VolumeX, HandCoins, AlertTriangle } from "lucide-react";
import { fetchPending, showLocalNotification, type PendingItem } from "@/lib/notifications";
import { playAlertSound, setSoundEnabled, soundEnabled } from "@/lib/alert-sound";

interface Props {
  userId: string;
  /** Polling interval in ms. */
  intervalMs?: number;
}

// Seen-ids are scoped per user so accounts sharing a device don't suppress
// each other's alerts. The legacy unscoped key is read once as a fallback.
const seenKey = (userId: string) => `daftarak.alert.seenIds.${userId}`;

function loadSeen(userId: string): Set<string> {
  try {
    const raw =
      localStorage.getItem(seenKey(userId)) ?? localStorage.getItem("daftarak.alert.seenIds");
    return new Set(JSON.parse(raw ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveSeen(userId: string, ids: Set<string>) {
  try {
    localStorage.setItem(seenKey(userId), JSON.stringify([...ids].slice(-400)));
  } catch {
    /* ignore */
  }
}

/**
 * On-screen alert center: shows new reminders/overdue debts as banners pinned
 * to the top of the screen and plays a distinct sound per alert type.
 */
export function AlertCenter({ userId, intervalMs = 60_000 }: Props) {
  const [queue, setQueue] = useState<PendingItem[]>([]);
  const [muted, setMuted] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    seen.current = loadSeen(userId);
    setMuted(!soundEnabled());
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const items = await fetchPending(userId).catch(() => [] as PendingItem[]);
      if (cancelled) return;
      const fresh = items.filter((i) => !seen.current.has(i.id));
      if (fresh.length === 0) return;
      for (const i of fresh) seen.current.add(i.id);
      saveSeen(userId, seen.current);

      // The first pass after load only primes known alerts on a cold start so
      // the user is not flooded; later passes are real-time notifications.
      if (!primed.current) {
        primed.current = true;
        setQueue(fresh.slice(0, 3));
      } else {
        setQueue((prev) => [...fresh.slice(0, 3), ...prev].slice(0, 4));
      }

      const worst = fresh.some((i) => i.kind === "overdue") ? "overdue" : "reminder";
      playAlertSound(worst);
      showLocalNotification(
        worst === "overdue" ? "دفترك — دين متأخر" : "دفترك — تذكير مستحق",
        fresh.length === 1 ? fresh[0]!.title : `لديك ${fresh.length} تنبيهات جديدة`,
      );
    };

    void tick();
    const t = setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [userId, intervalMs]);

  const dismiss = (id: string) => setQueue((q) => q.filter((i) => i.id !== id));

  if (queue.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] pointer-events-none px-2 pt-2 space-y-1.5">
      {queue.map((item) => {
        const overdue = item.kind === "overdue";
        const Icon = overdue ? AlertTriangle : item.amount ? HandCoins : BellRing;
        return (
          <div
            key={item.id}
            className={`pointer-events-auto max-w-md mx-auto rounded-xl border-2 shadow-elevated backdrop-blur px-2.5 py-2 flex items-start gap-2 animate-in slide-in-from-top-2 fade-in duration-300 ${
              overdue
                ? "bg-danger-soft/95 border-danger/40 text-danger"
                : "bg-card/95 border-primary/40 text-foreground"
            }`}
            role="alert"
          >
            <span
              className={`size-7 shrink-0 rounded-lg flex items-center justify-center ring-1 ${
                overdue
                  ? "bg-danger/15 ring-danger/30"
                  : "bg-primary/10 text-primary ring-primary/25"
              }`}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[11.5px] font-black truncate">{item.title}</div>
              <div className="text-[10.5px] opacity-80 tabular-nums">
                {overdue ? "متأخر منذ " : "مستحق: "}
                {new Date(item.due_date).toLocaleDateString("ar")}
                {item.amount ? ` · ${item.amount.toLocaleString("en-US")}` : ""}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {item.person_id ? (
                  <Link
                    to="/app/person/$id"
                    params={{ id: item.person_id }}
                    onClick={() => dismiss(item.id)}
                    className="text-[10px] font-bold underline"
                  >
                    فتح حساب العميل
                  </Link>
                ) : (
                  <Link
                    to="/app/reminders"
                    onClick={() => dismiss(item.id)}
                    className="text-[10px] font-bold underline"
                  >
                    فتح التذكيرات
                  </Link>
                )}
                <Link
                  to="/app/today"
                  onClick={() => dismiss(item.id)}
                  className="text-[10px] font-bold underline opacity-80"
                >
                  مهام اليوم
                </Link>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <button
                onClick={() => dismiss(item.id)}
                aria-label="إغلاق التنبيه"
                className="p-0.5 rounded hover:bg-foreground/10"
              >
                <X className="size-3.5" />
              </button>
              <button
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  setSoundEnabled(!next);
                  if (!next) playAlertSound("success", true);
                }}
                aria-label={muted ? "تشغيل الأصوات" : "كتم الأصوات"}
                className="p-0.5 rounded hover:bg-foreground/10 opacity-70"
              >
                {muted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
              </button>
            </div>
          </div>
        );
      })}
      <div className="sr-only" aria-live="polite">
        <Bell className="size-3" /> {queue.length} تنبيه جديد
      </div>
    </div>
  );
}
