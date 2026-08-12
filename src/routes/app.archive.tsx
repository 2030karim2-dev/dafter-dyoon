import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ArrowRight, ArchiveRestore, Trash2, Archive } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/app/archive")({ component: ArchivePage });

interface Person {
  id: string;
  name: string;
}

function ArchivePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Person[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Person | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("people")
      .select("id,name")
      .eq("user_id", user.id)
      .eq("is_archived", true)
      .order("name");
    setItems((data ?? []) as Person[]);
  };
  useEffect(() => {
    load();
  }, [user]);

  const restore = async (id: string) => {
    await supabase.from("people").update({ is_archived: false }).eq("id", id);
    toast.success("تمت الاستعادة");
    load();
  };
  const del = async () => {
    if (!pendingDelete) return;
    await supabase.from("transactions").delete().eq("person_id", pendingDelete.id);
    const { error } = await supabase.from("people").delete().eq("id", pendingDelete.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم الحذف");
    load();
  };

  return (
    <div className="space-y-4">
      <Link
        to="/app/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" /> رجوع
      </Link>
      <div className="flex items-center gap-2">
        <div className="size-10 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
          <Archive className="size-5" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">الأرشيف</h1>
          <p className="text-xs text-muted-foreground">{items.length} شخص مؤرشف</p>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="الأرشيف فارغ"
          description="عند أرشفة شخص ستجده هنا للاستعادة."
        />
      ) : (
        <Card className="p-2">
          {items.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors"
            >
              <div className="size-10 rounded-xl bg-secondary text-muted-foreground flex items-center justify-center font-bold">
                {p.name.charAt(0)}
              </div>
              <div className="flex-1 font-semibold text-sm">{p.name}</div>
              <button
                onClick={() => restore(p.id)}
                className="p-2 text-muted-foreground hover:text-success"
                title="استعادة"
              >
                <ArchiveRestore className="size-4" />
              </button>
              <button
                onClick={() => setPendingDelete(p)}
                className="p-2 text-muted-foreground hover:text-danger"
                title="حذف نهائي"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title={`حذف ${pendingDelete?.name ?? ""} نهائياً؟`}
        description="سيتم حذف هذا الشخص وكل معاملاته ومرفقاته. هذا الإجراء لا يمكن التراجع عنه."
        confirmLabel="حذف نهائي"
        destructive
        onConfirm={del}
      />
    </div>
  );
}
