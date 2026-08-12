import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Bell, AlarmClock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import {
  completeReminder,
  snoozeReminder,
  syncRemindersFromTransactions,
  type Reminder,
} from "@/lib/reminders";
import { ReminderCard, REPEAT_LABEL } from "@/features/reminders/ReminderCard";
import { ReminderFormDialog } from "@/features/reminders/ReminderFormDialog";

export const Route = createFileRoute("/app/reminders")({ component: RemindersPage });

interface Person {
  id: string;
  name: string;
}
type Filter = "overdue" | "today" | "upcoming" | "done";

function RemindersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Reminder[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [filter, setFilter] = useState<Filter>("overdue");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("reminders").select("*").order("due_date"),
      supabase.from("people").select("id,name").eq("is_archived", false),
    ]);
    setItems((r ?? []) as Reminder[]);
    setPeople((p ?? []) as Person[]);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      await syncRemindersFromTransactions(user.id);
      await load();
    })();
  }, [user, load]);

  const sync = async () => {
    if (!user) return;
    setSyncing(true);
    const n = await syncRemindersFromTransactions(user.id);
    setSyncing(false);
    toast.success(n > 0 ? `تم إضافة ${n} تذكير من الديون` : "لا توجد ديون جديدة بتاريخ استحقاق");
    load();
  };

  const toggleDone = async (r: Reminder) => {
    if (r.is_done) {
      await supabase.from("reminders").update({ is_done: false }).eq("id", r.id);
    } else {
      await completeReminder(r);
      if (r.repeat !== "none") toast.success(`تم. التالي: ${REPEAT_LABEL[r.repeat]}`);
    }
    load();
  };

  const snooze = async (id: string, days: number) => {
    await snoozeReminder(id, days);
    toast.success(`مؤجل ${days === 1 ? "يوم" : `${days} أيام`}`);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("حذف التذكير؟")) return;
    await supabase.from("reminders").delete().eq("id", id);
    toast.success("تم الحذف");
    load();
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);
    return items.filter((r) => {
      const d = new Date(r.due_date);
      if (filter === "done") return r.is_done;
      if (r.is_done) return false;
      if (filter === "overdue") return d < startToday;
      if (filter === "today") return d >= startToday && d <= endToday;
      return d > endToday;
    });
  }, [items, filter]);

  const counts = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);
    const c = { overdue: 0, today: 0, upcoming: 0, done: 0 };
    for (const r of items) {
      if (r.is_done) {
        c.done++;
        continue;
      }
      const d = new Date(r.due_date);
      if (d < startToday) c.overdue++;
      else if (d <= endToday) c.today++;
      else c.upcoming++;
    }
    return c;
  }, [items]);

  const TABS: Array<{ id: Filter; label: string; count: number; tone: string }> = [
    { id: "overdue", label: "متأخر", count: counts.overdue, tone: "text-danger" },
    { id: "today", label: "اليوم", count: counts.today, tone: "text-warning" },
    { id: "upcoming", label: "قادمة", count: counts.upcoming, tone: "text-primary" },
    { id: "done", label: "مكتملة", count: counts.done, tone: "text-success" },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        icon={Bell}
        title="التذكيرات"
        subtitle={`${counts.overdue + counts.today + counts.upcoming} نشط · ${counts.done} مكتمل`}
        back="/app"
      />

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={sync}
          disabled={syncing}
          className="h-8 text-[11px] gap-1"
        >
          <RefreshCw className={`size-3 ${syncing ? "animate-spin" : ""}`} /> مزامنة من الديون
        </Button>
        {user && (
          <ReminderFormDialog
            open={open}
            onOpenChange={(v) => {
              if (!v) setEditing(null);
              setOpen(v);
            }}
            editing={editing}
            userId={user.id}
            people={people}
            onSaved={load}
          />
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 ${
              filter === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/70"
            }`}
          >
            <span>{t.label}</span>
            <span className={`text-[10px] font-bold ${filter === t.id ? "opacity-80" : t.tone}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={AlarmClock}
          title="لا توجد تذكيرات"
          description="أضف تذكيراً أو زامن من الديون التي لها تاريخ استحقاق"
        />
      ) : (
        <div className="space-y-1.5 animate-in fade-in">
          {filtered.map((r) => (
            <ReminderCard
              key={r.id}
              r={r}
              personName={people.find((p) => p.id === r.person_id)?.name}
              onToggle={() => toggleDone(r)}
              onSnooze={(d) => snooze(r.id, d)}
              onEdit={() => {
                setEditing(r);
                setOpen(true);
              }}
              onDelete={() => del(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
