import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { fmtDate, fmtTime, fmtMoney } from "@/lib/format";
import {
  getReceiptVouchersFn,
  deleteReceiptVoucherFn,
  type ReceiptVoucher,
} from "@/lib/receipts.functions";
import { exportReceiptPDF } from "@/lib/io/exportPdf";
import { ReceiptText, Printer, Trash2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/receipts")({ component: ReceiptsPage });

function ReceiptsPage() {
  const qc = useQueryClient();
  const getReceipts = useServerFn(getReceiptVouchersFn);
  const del = useServerFn(deleteReceiptVoucherFn);
  const [pendingDelete, setPendingDelete] = useState<ReceiptVoucher | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const { data: receipts, isLoading } = useQuery({
    queryKey: ["receipt-vouchers"],
    queryFn: () => getReceipts(),
    staleTime: 20_000,
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف السند");
      void qc.invalidateQueries({ queryKey: ["receipt-vouchers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const print = async (r: ReceiptVoucher) => {
    setPrintingId(r.id);
    try {
      await exportReceiptPDF({
        serialNumber: r.serial_number,
        personName: r.person_name,
        phone: r.phone,
        currencyName: r.currency_name,
        amount: r.amount,
        amountWords: r.amount_words,
        note: r.note,
        issuedAt: r.issued_at,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل طباعة السند");
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ReceiptText}
        title="سندات القبض"
        subtitle="جميع سندات القبض الصادرة — يمكن إعادة طباعتها في أي وقت"
        back="/app/reports"
      />

      {isLoading ? (
        <Card className="p-6 flex justify-center">
          <Loader2 className="size-5 animate-spin text-primary" />
        </Card>
      ) : !receipts || receipts.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="لا توجد سندات بعد"
          description="سجّل دفعة من صفحة العميل واختر «توليد سند قبض» ليظهر السند هنا"
          action={
            <Link to="/app" className="inline-block">
              <Button className="bg-gradient-primary text-primary-foreground">
                الانتقال للديون
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {receipts.map((r) => (
            <Card key={r.id} className="p-3 flex items-center gap-3">
              <div className="size-9 rounded-lg bg-gradient-primary text-primary-foreground flex items-center justify-center shrink-0">
                <ReceiptText className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[13px] truncate">{r.person_name}</span>
                  <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5 tabular-nums whitespace-nowrap">
                    سند #{String(r.serial_number).padStart(5, "0")}
                  </span>
                </div>
                <div className="text-[10.5px] text-muted-foreground mt-0.5 truncate">
                  {fmtDate(r.issued_at)} · {fmtTime(r.issued_at)}
                  {r.currency_name ? ` · ${r.currency_name}` : ""}
                  {r.note ? ` · ${r.note}` : ""}
                </div>
              </div>
              <div className="text-left shrink-0">
                <div className="font-black text-[13px] tabular-nums">{fmtMoney(r.amount)}</div>
                <div className="text-[9px] text-muted-foreground">{r.currency_name || ""}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => print(r)}
                  disabled={printingId === r.id}
                  title="طباعة"
                >
                  {printingId === r.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Printer className="size-3.5" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8 text-danger"
                  onClick={() => setPendingDelete(r)}
                  title="حذف"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title="حذف السند؟"
        description={`سند #${
          pendingDelete ? String(pendingDelete.serial_number).padStart(5, "0") : ""
        } — ${pendingDelete?.person_name ?? ""}`}
        confirmLabel="حذف"
        destructive
        busy={delM.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          return delM.mutateAsync(pendingDelete.id).then(() => undefined);
        }}
      />
    </div>
  );
}
