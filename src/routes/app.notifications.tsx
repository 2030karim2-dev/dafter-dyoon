import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { fetchPending, markAllSeen, type PendingItem } from "@/lib/notifications";
import { fmtDate } from "@/lib/format";
import { Bell, AlarmClock, ArrowLeft, Check, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/notifications")({ component: NotificationsCenter });

function NotificationsCenter() {
  const { user } = useAuth();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const list = await fetchPending(user.id);
    setItems(list);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      await load();
      await markAllSeen(user.id);
    })();
  }, [user, load]);

  const markDone = async (it: PendingItem) => {
    if (it.kind === "overdue" && it.transaction_id) {
      await supabase.from("transactions").update({ is_paid: true }).eq("id", it.transaction_id);
      toast.success("تم تعليم الدين كمسدّد");
    } else {
      await supabase.from("reminders").update({ is_done: true }).eq("id", it.id);
      toast.success("تم");
    }
    setItems((xs) => xs.filter((x) => x.id !== it.id));
  };

  const snooze = async (it: PendingItem, days = 1) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    if (it.kind === "overdue" && it.transaction_id) {
      await supabase
        .from("transactions")
        .update({ due_date: d.toISOString().slice(0, 10) })
        .eq("id", it.transaction_id);
    } else {
      await supabase
        .from("reminders")
        .update({ due_date: d.toISOString(), snoozed_until: d.toISOString() })
        .eq("id", it.id);
    }
    setItems((xs) => xs.filter((x) => x.id !== it.id));
    toast.success(`مؤجل ${days} يوم`);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Bell}
        title="مركز الإشعارات"
        subtitle={`${items.length} تنبيه`}
        back="/app"
      />

      {loading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">جارٍ التحميل...</Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="لا توجد إشعارات"
          description="ستظهر هنا التذكيرات المستحقة والديون المتأخرة"
        />
      ) : (
        <div className="space-y-2 animate-in fade-in">
          {items.map((it) => (
            <Card key={it.id} className="p-3 flex items-start gap-3">
              <div className="size-10 rounded-xl bg-danger-soft text-danger flex items-center justify-center shrink-0">
                <AlarmClock className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{it.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {fmtDate(it.due_date)}
                </div>
                <div className="flex gap-1.5 mt-2">
                  <button
                    onClick={() => markDone(it)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-success-soft text-success hover:opacity-80"
                  >
                    <Check className="size-3" /> تم
                  </button>
                  <button
                    onClick={() => snooze(it, 1)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-secondary text-foreground hover:opacity-80"
                  >
                    <Clock className="size-3" /> تأجيل يوم
                  </button>
                  <button
                    onClick={() => snooze(it, 7)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-secondary text-foreground hover:opacity-80"
                  >
                    أسبوع
                  </button>
                </div>
              </div>
              <Link
                to="/app/reminders"
                className="text-primary text-xs font-semibold p-1"
                aria-label="فتح التذكيرات"
              >
                <ArrowLeft className="size-4" />
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
