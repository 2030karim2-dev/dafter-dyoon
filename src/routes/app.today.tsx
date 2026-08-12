import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sun, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { TodayTabs, type TodayTab } from "@/features/today/TodayTabs";
import { TodaySummary } from "@/features/today/TodaySummary";
import { TodayTaskCard } from "@/features/today/TodayTaskCard";
import { PaymentDialog } from "@/features/today/PaymentDialog";
import { PromiseDialog } from "@/features/today/PromiseDialog";
import { MessageSheet } from "@/features/followup/MessageSheet";
import { EMPTY_TODAY, useToday } from "@/features/today/useToday";
import type { TodayTask } from "@/lib/today.functions";
import { buildMessageFn, markSentFn, sendOutboxFn } from "@/lib/messaging.functions";
import { smartMatch } from "@/lib/search/match";

export const Route = createFileRoute("/app/today")({
  component: TodayPage,
  head: () => ({
    meta: [
      { title: "مهام اليوم | دفترك" },
      {
        name: "description",
        content:
          "صندوق عمل يومي يجمع الديون المستحقة والمتأخرة ووعود السداد والرسائل الفاشلة في مكان واحد.",
      },
      { property: "og:title", content: "مهام اليوم | دفترك" },
      {
        property: "og:description",
        content: "ابدأ يومك بقائمة واضحة: من تتصل به، من تذكّره، ومن وعد بالسداد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Sheet =
  | { type: "pay"; task: TodayTask }
  | { type: "promise"; task: TodayTask }
  | { type: "message"; task: TodayTask; body: string }
  | null;

function TodayPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading, refetch, isFetching } = useToday();
  const payload = data ?? EMPTY_TODAY;

  const [tab, setTab] = useState<TodayTab>("all");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);

  const buildMessage = useServerFn(buildMessageFn);
  const markSent = useServerFn(markSentFn);
  const sendOutbox = useServerFn(sendOutboxFn);

  const rows = useMemo(() => {
    return payload.tasks.filter((t) => {
      const tabOk =
        tab === "all"
          ? true
          : tab === "pending"
            ? !t.reminded
            : tab === "reminded"
              ? t.reminded
              : t.kind === tab;
      if (!tabOk) return false;
      return smartMatch(q, {
        text: [t.person_name, t.note, t.currency_name],
        phones: [t.phone],
        numbers: [t.amount],
      });
    });
  }, [payload.tasks, tab, q]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["today-board"] });
    void qc.invalidateQueries({ queryKey: ["followup-board"] });
    void qc.invalidateQueries({ queryKey: ["home"] });
  };

  const build = useMutation({
    mutationFn: (t: TodayTask) =>
      buildMessage({ data: { person_id: t.person_id, currency_id: t.currency_id } }),
    onSuccess: (res, t) => setSheet({ type: "message", task: t, body: res.body }),
    onError: (e: Error) => toast.error(e.message),
  });

  const queueOne = useMutation({
    mutationFn: async (t: TodayTask) => {
      const res = await buildMessage({
        data: { person_id: t.person_id, currency_id: t.currency_id, enqueue: true },
      });
      if (res.outbox_id) await markSent({ data: { id: res.outbox_id } });
      return res;
    },
    onSuccess: () => {
      toast.success("تم تسجيل التذكير في سجل المتابعة");
      setSheet(null);
      invalidate();
      void qc.invalidateQueries({ queryKey: ["outbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoSend = useMutation({
    mutationFn: async (t: TodayTask) => {
      const res = await buildMessage({
        data: { person_id: t.person_id, currency_id: t.currency_id, enqueue: true },
      });
      if (!res.outbox_id) throw new Error("تعذّر تجهيز الرسالة");
      return sendOutbox({ data: { id: res.outbox_id } });
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("تم الإرسال");
        setSheet(null);
      } else toast.error(res.error ?? "فشل الإرسال");
      invalidate();
      void qc.invalidateQueries({ queryKey: ["outbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retry = useMutation({
    mutationFn: (t: TodayTask) => sendOutbox({ data: { id: t.outbox_id! } }),
    onSuccess: (res) => {
      if (res.ok) toast.success("تم الإرسال");
      else toast.error(res.error ?? "فشل الإرسال");
      invalidate();
      void qc.invalidateQueries({ queryKey: ["outbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2.5">
      <PageHeader
        icon={Sun}
        title="مهام اليوم"
        subtitle="ابدأ من هنا: كل ما يحتاج إجراءً اليوم"
        back="/app"
        actions={
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            onClick={() => void refetch()}
          >
            <RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} /> تحديث
          </Button>
        }
      />

      <TodaySummary payload={payload} />
      <TodayTabs tab={tab} counts={payload.counts} onChange={setTab} />
      <SearchBar value={q} onChange={setQ} placeholder="ابحث باسم متقطع، رقم هاتف، أو مبلغ..." />

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Sun}
          title="لا مهام اليوم"
          description="لا يوجد مستحق أو متأخر أو وعد يحتاج متابعة الآن."
        />
      ) : (
        <div className="space-y-1.5">
          {rows.map((t) => (
            <TodayTaskCard
              key={t.id}
              task={t}
              onOpen={() => navigate({ to: "/app/person/$id", params: { id: t.person_id } })}
              canAuto={payload.availability.whatsapp_auto}
              onMessage={() => build.mutate(t)}
              onAutoSend={() => autoSend.mutate(t)}
              onPay={() => setSheet({ type: "pay", task: t })}
              onPromise={() => setSheet({ type: "promise", task: t })}
              onRetry={() => retry.mutate(t)}
            />
          ))}
        </div>
      )}

      {sheet?.type === "pay" && (
        <PaymentDialog
          open
          onOpenChange={(v) => !v && setSheet(null)}
          personId={sheet.task.person_id}
          personName={sheet.task.person_name}
          currencyId={sheet.task.currency_id}
          currencyLabel={sheet.task.currency_symbol || sheet.task.currency_name}
          suggested={sheet.task.amount}
          onDone={invalidate}
        />
      )}

      {sheet?.type === "promise" && (
        <PromiseDialog
          open
          onOpenChange={(v) => !v && setSheet(null)}
          personId={sheet.task.person_id}
          personName={sheet.task.person_name}
          currencyId={sheet.task.currency_id}
          currencyLabel={sheet.task.currency_symbol || sheet.task.currency_name}
          suggested={sheet.task.amount}
          onDone={invalidate}
        />
      )}

      {sheet?.type === "message" && (
        <MessageSheet
          name={sheet.task.person_name}
          body={sheet.body}
          loading={build.isPending}
          phone={sheet.task.phone}
          canAuto={payload.availability.whatsapp_auto}
          onBodyChange={(v) => setSheet({ ...sheet, body: v })}
          onQueue={() => queueOne.mutate(sheet.task)}
          onAutoSend={() => autoSend.mutate(sheet.task)}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
