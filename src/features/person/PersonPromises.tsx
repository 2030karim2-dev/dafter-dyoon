import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/format";
import { getPromisesFn, resolvePromiseFn } from "@/lib/today.functions";
import { CalendarClock, Check, X, Loader2 } from "lucide-react";

const TONE: Record<string, string> = {
  open: "bg-warning/10 text-warning ring-warning/20",
  kept: "bg-success/10 text-success ring-success/20",
  broken: "bg-danger/10 text-danger ring-danger/20",
  cancelled: "bg-secondary text-muted-foreground ring-border",
};
const LABEL: Record<string, string> = {
  open: "قائم",
  kept: "تم الوفاء",
  broken: "لم يُوفَ",
  cancelled: "ملغى",
};

/** Promise-to-pay log for one customer; statuses are resolved on the server. */
export function PersonPromises({
  personId,
  currencyId,
}: {
  personId: string;
  currencyId: string | null;
}) {
  const qc = useQueryClient();
  const getPromises = useServerFn(getPromisesFn);
  const resolve = useServerFn(resolvePromiseFn);

  const { data, isLoading } = useQuery({
    queryKey: ["person-promises", personId],
    queryFn: () => getPromises({ data: { person_id: personId } }),
    staleTime: 20_000,
  });

  const act = useMutation({
    mutationFn: (v: { id: string; status: "kept" | "cancelled" }) => resolve({ data: v }),
    onSuccess: () => {
      toast.success("تم تحديث الوعد");
      void qc.invalidateQueries({ queryKey: ["person-promises", personId] });
      void qc.invalidateQueries({ queryKey: ["person-feed", personId] });
      void qc.invalidateQueries({ queryKey: ["today-board"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="size-4 animate-spin text-primary" />
      </div>
    );
  }
  const rows = (data ?? []).filter((p) => !currencyId || p.currency_id === currencyId);
  if (rows.length === 0) {
    return (
      <p className="text-center text-[11px] text-muted-foreground py-6">لا توجد وعود سداد مسجلة</p>
    );
  }

  return (
    <div className="space-y-1">
      {rows.map((p) => (
        <div key={p.id} className="flex items-center gap-2 bg-card border rounded-lg p-2">
          <div className="size-6 rounded-md bg-warning/10 text-warning flex items-center justify-center shrink-0">
            <CalendarClock className="size-3" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-[12px] tabular-nums">
                {fmtMoney(Number(p.amount))}
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ring-1 ${TONE[p.status] ?? TONE.cancelled}`}
              >
                {LABEL[p.status] ?? p.status}
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground tabular-nums">
              موعد: {new Date(p.promised_date).toLocaleDateString("ar-SA")}
              {p.note ? ` · ${p.note}` : ""}
            </p>
          </div>
          {p.status === "open" && (
            <div className="flex gap-1 shrink-0">
              <Button
                size="icon"
                variant="outline"
                className="size-6"
                onClick={() => act.mutate({ id: p.id, status: "kept" })}
                title="تم الوفاء"
              >
                <Check className="size-3 text-success" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="size-6"
                onClick={() => act.mutate({ id: p.id, status: "cancelled" })}
                title="إلغاء"
              >
                <X className="size-3 text-muted-foreground" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
