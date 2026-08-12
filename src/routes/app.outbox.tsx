import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Inbox, Loader2, Send, Trash2, Check, MessageCircle } from "lucide-react";
import {
  deleteOutboxFn,
  getOutboxFn,
  markSentFn,
  sendOutboxFn,
  type OutboxRow,
} from "@/lib/messaging.functions";

export const Route = createFileRoute("/app/outbox")({
  component: OutboxPage,
  head: () => ({
    meta: [
      { title: "صادر الرسائل والتذكيرات | دفترك" },
      {
        name: "description",
        content: "طابور رسائل التذكير الجاهزة للإرسال عبر واتساب وتليجرام والرسائل النصية.",
      },
      { property: "og:title", content: "صادر الرسائل والتذكيرات | دفترك" },
      {
        property: "og:description",
        content: "أدر رسائل التذكير المجهزة من الواجهة الخلفية وأرسلها بضغطة واحدة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUS: Record<string, { label: string; cls: string }> = {
  queued: { label: "في الانتظار", cls: "bg-secondary text-primary" },
  sent: { label: "تم الإرسال", cls: "bg-success-soft text-success" },
  failed: { label: "فشل", cls: "bg-danger-soft text-danger" },
};

const CHANNEL: Record<string, string> = {
  whatsapp: "واتساب",
  telegram: "تليجرام",
  sms: "رسالة نصية",
};

function OutboxPage() {
  const qc = useQueryClient();
  const fetchOutbox = useServerFn(getOutboxFn);
  const send = useServerFn(sendOutboxFn);
  const mark = useServerFn(markSentFn);
  const remove = useServerFn(deleteOutboxFn);
  const [filter, setFilter] = useState<"queued" | "sent" | "failed" | "all">("queued");

  const { data, isLoading } = useQuery({
    queryKey: ["outbox"],
    queryFn: () => fetchOutbox(),
    staleTime: 15_000,
  });

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    return filter === "all" ? all : all.filter((r) => r.status === filter);
  }, [data, filter]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["outbox"] });
    void qc.invalidateQueries({ queryKey: ["followup-board"] });
  };

  const doSend = useMutation({
    mutationFn: (id: string) => send({ data: { id } }),
    onSuccess: (res) => {
      if (res.ok) toast.success("تم الإرسال");
      else toast.error(res.error ?? "فشل الإرسال");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doMark = useMutation({
    mutationFn: (id: string) => mark({ data: { id } }),
    onSuccess: () => {
      toast.success("تم التأشير كمُرسلة");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doDelete = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("تم الحذف");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openWhatsApp = (r: OutboxRow) => {
    if (!r.destination) return toast.error("لا يوجد رقم للعميل");
    window.open(`https://wa.me/${r.destination}?text=${encodeURIComponent(r.body)}`, "_blank");
    doMark.mutate(r.id);
  };

  return (
    <div className="space-y-2.5">
      <PageHeader
        icon={Inbox}
        title="الصادر"
        subtitle="رسائل التذكير المجهزة في الواجهة الخلفية"
        back="/app/followup"
      />

      <div className="grid grid-cols-4 gap-1">
        {(["queued", "sent", "failed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg p-1.5 border text-[11px] font-bold transition ${filter === f ? "bg-primary text-primary-foreground border-transparent" : "bg-card hover:bg-secondary"}`}
          >
            {f === "all" ? "الكل" : STATUS[f].label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="لا توجد رسائل"
          description="سيتم تجهيز التذكيرات تلقائياً حسب سياسة المتابعة."
        />
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const st = STATUS[r.status] ?? STATUS.queued;
            return (
              <Card key={r.id} className="p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[12px] flex-1 truncate">
                    {r.person_name ?? "—"}
                  </span>
                  <span className="text-[10.5px] px-1 py-px rounded bg-secondary text-muted-foreground">
                    {CHANNEL[r.channel] ?? r.channel}
                  </span>
                  <span className={`text-[10.5px] px-1 py-px rounded font-bold ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
                <pre className="text-[10.5px] whitespace-pre-wrap leading-relaxed bg-secondary/60 rounded p-1.5 max-h-28 overflow-auto font-sans">
                  {r.body}
                </pre>
                {r.last_error && <div className="text-[10px] text-danger">خطأ: {r.last_error}</div>}
                <div className="flex gap-1">
                  {r.status !== "sent" && (
                    <>
                      <Button
                        size="sm"
                        className="h-7 text-[10.5px] flex-1 bg-success text-success-foreground hover:bg-success/90"
                        onClick={() => openWhatsApp(r)}
                      >
                        <MessageCircle className="size-3" /> واتساب
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10.5px] flex-1"
                        onClick={() => doSend.mutate(r.id)}
                        disabled={doSend.isPending}
                      >
                        <Send className="size-3" /> تلقائي
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10.5px]"
                        onClick={() => doMark.mutate(r.id)}
                      >
                        <Check className="size-3" />
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10.5px] text-danger"
                    onClick={() => doDelete.mutate(r.id)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
