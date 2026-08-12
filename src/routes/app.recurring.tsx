import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { processDueRecurring } from "@/lib/recurring";
import { Button } from "@/components/ui/button";
import { ArrowRight, Repeat, RotateCw } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { RecurringRuleCard, type Rule } from "@/features/recurring/RecurringRuleCard";
import { RecurringFormDialog } from "@/features/recurring/RecurringFormDialog";

export const Route = createFileRoute("/app/recurring")({ component: RecurringPage });

interface Cur {
  id: string;
  name: string;
  is_base: boolean;
}
interface Person {
  id: string;
  name: string;
}

function RecurringPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Rule[]>([]);
  const [curs, setCurs] = useState<Cur[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: r }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("recurring_rules").select("*").order("next_run"),
      supabase.from("currencies").select("id,name,is_base").order("is_base", { ascending: false }),
      supabase.from("people").select("id,name").eq("is_archived", false),
    ]);
    setItems((r ?? []) as Rule[]);
    setCurs((c ?? []) as Cur[]);
    setPeople((p ?? []) as Person[]);
  };
  useEffect(() => {
    load();
  }, [user]);

  const toggleActive = async (r: Rule) => {
    await supabase.from("recurring_rules").update({ is_active: !r.is_active }).eq("id", r.id);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("حذف هذه الدورية؟")) return;
    await supabase.from("recurring_rules").delete().eq("id", id);
    toast.success("تم الحذف");
    load();
  };

  const runNow = async () => {
    if (!user) return;
    const n = await processDueRecurring(user.id);
    toast.success(n > 0 ? `تم توليد ${n} عملية` : "لا توجد عمليات مستحقة");
    load();
  };

  return (
    <div className="space-y-4">
      <Link
        to="/app/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" /> رجوع للإعدادات
      </Link>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-10 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
            <Repeat className="size-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">المعاملات المتكررة</h1>
            <p className="text-xs text-muted-foreground">{items.length} دورية</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button onClick={runNow} variant="outline" size="sm" title="توليد المستحقات الآن">
            <RotateCw className="size-4" />
          </Button>
          {user && (
            <RecurringFormDialog
              open={open}
              onOpenChange={setOpen}
              userId={user.id}
              curs={curs}
              people={people}
              onSaved={load}
            />
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="لا توجد دوريات"
          description="أضف رواتب، إيجارات، اشتراكات لتُسجّل تلقائياً عند موعدها."
        />
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <RecurringRuleCard
              key={r.id}
              r={r}
              currencyName={curs.find((c) => c.id === r.currency_id)?.name ?? ""}
              onToggle={() => toggleActive(r)}
              onDelete={() => del(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
