import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { fmtMoney, fmtDate } from "@/lib/format";
import { getPlansFn, cancelPlanFn, type PlanDTO } from "@/lib/plans.functions";
import { exportPlanSchedulePDF } from "@/lib/io/exportPdf";
import { waPhone } from "@/lib/phone";
import { CalendarRange, Loader2, Printer, Send, X } from "lucide-react";

const TONE: Record<string, string> = {
  open: "bg-warning/10 text-warning ring-warning/20",
  kept: "bg-success/10 text-success ring-success/20",
  broken: "bg-danger/10 text-danger ring-danger/20",
  cancelled: "bg-secondary text-muted-foreground ring-border",
};

/** خطط السداد (الأقساط) لعميل واحد — تُعرض أعلى تبويب الوعود. */
export function PersonPlans({
  personId,
  personName,
  currencyId,
  personPhone,
  currencyName,
}: {
  personId: string;
  personName: string;
  currencyId: string | null;
  personPhone?: string | null;
  currencyName: string;
}) {
  const qc = useQueryClient();
  const getPlans = useServerFn(getPlansFn);
  const cancel = useServerFn(cancelPlanFn);
  const [pendingCancel, setPendingCancel] = useState<PlanDTO | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["person-plans", personId],
    queryFn: () => getPlans({ data: { person_id: personId } }),
    staleTime: 20_000,
  });

  const cancelM = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      toast.success("تم إلغاء الخطة — أُلغيت أقساطها المفتوحة");
      void qc.invalidateQueries({ queryKey: ["person-plans", personId] });
      void qc.invalidateQueries({ queryKey: ["person-promises", personId] });
      void qc.invalidateQueries({ queryKey: ["today-board"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const printPlan = async (p: PlanDTO) => {
    setBusyId(p.id);
    try {
      await exportPlanSchedulePDF({
        personName,
        personPhone,
        currencyName,
        totalAmount: p.total_amount,
        installmentAmount: p.installment_amount,
        frequency: p.frequency,
        startDate: p.start_date,
        status: p.status,
        note: p.note,
        installments: p.installments,
        keptCount: p.kept_count,
        paidTotal: p.paid_total,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل طباعة الجدول");
    } finally {
      setBusyId(null);
    }
  };

  const sharePlan = (p: PlanDTO) => {
    const lines: string[] = [
      `السلام عليكم ${personName}،`,
      "",
      `جدول سداد المبلغ ${fmtMoney(p.total_amount)} ${currencyName} (${p.frequency === "monthly" ? "شهري" : "أسبوعي"}):`,
      "",
      ...p.installments.map(
        (ins, i) => `${i + 1}. ${fmtDate(ins.promised_date)} — ${fmtMoney(ins.amount)}`,
      ),
      "",
      "نرجو الالتزام بمواعيد الأقساط، مع خالص الشكر والتقدير.",
    ];
    const text = encodeURIComponent(lines.join("\n"));
    const ph = waPhone(personPhone);
    window.open(ph ? `https://wa.me/${ph}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="size-4 animate-spin text-primary" />
      </div>
    );
  }
  const rows = (data ?? []).filter((p) => !currencyId || p.currency_id === currencyId);
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold text-muted-foreground px-1 flex items-center gap-1">
        <CalendarRange className="size-3" /> خطط السداد
      </div>

      {rows.map((p) => {
        const completed = p.status === "active" && p.kept_count === p.installments_count;
        const cancelled = p.status === "cancelled";
        const badge = cancelled
          ? "bg-secondary text-muted-foreground ring-border"
          : completed
            ? "bg-success/10 text-success ring-success/20"
            : "bg-primary/10 text-primary ring-primary/20";
        return (
          <div key={p.id} className="bg-card border rounded-lg p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-extrabold tabular-nums">
                  {fmtMoney(p.total_amount)}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ring-1 ${badge}`}>
                  {cancelled ? "ملغاة" : completed ? "مكتملة" : "قائمة"}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {p.frequency === "monthly" ? "شهري" : "أسبوعي"} · {p.installments_count} قسط
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground">
              كل قسط {fmtMoney(p.installment_amount)} · البداية {fmtDate(p.start_date)}
              {p.kept_count > 0 ? ` · سُدّد ${fmtMoney(p.paid_total)}` : ""}
              {p.note ? ` · ${p.note}` : ""}
            </div>

            <div className="flex flex-wrap gap-1">
              {p.installments.map((ins) => (
                <span
                  key={ins.id}
                  className={`text-[9px] px-1.5 py-0.5 rounded ring-1 ${TONE[ins.status] ?? TONE.cancelled}`}
                >
                  {fmtDate(ins.promised_date)}: {fmtMoney(ins.amount)}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between gap-1 pt-0.5">
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px]"
                  onClick={() => printPlan(p)}
                  disabled={busyId === p.id}
                  title="طباعة جدول السداد PDF"
                >
                  {busyId === p.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Printer className="size-3" />
                  )}
                  طباعة
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px]"
                  onClick={() => sharePlan(p)}
                  title="إرسال الجدول عبر واتساب"
                >
                  <Send className="size-3" /> واتساب
                </Button>
              </div>
              {p.status === "active" && !completed && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] text-danger"
                  onClick={() => setPendingCancel(p)}
                >
                  <X className="size-3" /> إلغاء الخطة
                </Button>
              )}
            </div>
          </div>
        );
      })}

      <ConfirmDialog
        open={!!pendingCancel}
        onOpenChange={(v) => !v && setPendingCancel(null)}
        title="إلغاء خطة السداد؟"
        description={`ستُلغى الأقساط المفتوحة للخطة (${pendingCancel?.installments_count ?? 0} قسطاً) مع بقاء المسدّد منها محفوظاً.`}
        confirmLabel="إلغاء الخطة"
        destructive
        busy={cancelM.isPending}
        onConfirm={() => {
          if (!pendingCancel) return;
          return cancelM.mutateAsync(pendingCancel.id).then(() => undefined);
        }}
      />
    </div>
  );
}
