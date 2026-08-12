import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { fmtDate } from "@/lib/format";
import { History } from "lucide-react";

export const Route = createFileRoute("/app/activity")({ component: ActivityPage });

interface Row {
  id: string;
  action: string;
  entity: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const LABEL: Record<string, string> = {
  "create:transaction": "إضافة معاملة",
  "update:transaction": "تعديل معاملة",
  "delete:transaction": "حذف معاملة",
  "create:person": "إضافة شخص",
  "update:person": "تعديل شخص",
  "archive:person": "أرشفة شخص",
  "restore:person": "استعادة شخص",
  "backup:create": "إنشاء نسخة احتياطية",
  "backup:restore": "استعادة من نسخة",
};

function ActivityPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-4">
      <PageHeader icon={History} title="سجل النشاط" subtitle="آخر 100 عملية" back="/app/settings" />
      {loading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">جارٍ التحميل...</Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={History}
          title="لا يوجد نشاط"
          description="ستظهر هنا عمليات الإضافة والحذف والأرشفة"
        />
      ) : (
        <Card className="divide-y">
          {rows.map((r) => (
            <div key={r.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">
                  {LABEL[`${r.action}:${r.entity}`] ?? `${r.action} · ${r.entity}`}
                </div>
                <div className="text-[11px] text-muted-foreground">{fmtDate(r.created_at)}</div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
