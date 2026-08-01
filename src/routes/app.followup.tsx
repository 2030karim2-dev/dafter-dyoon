import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Send, Target, Inbox, CheckCheck, ListChecks, Zap, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AtRiskBanner } from "@/features/followup/AtRiskBanner";
import { FollowupCard } from "@/features/followup/FollowupCard";
import { FollowupTabs } from "@/features/followup/FollowupTabs";
import { MessageSheet } from "@/features/followup/MessageSheet";
import {
  EMPTY_BOARD,
  filterBuckets,
  useBoard,
  type FollowupTab,
} from "@/features/followup/useBoard";
import { runFollowupCycleFn } from "@/lib/followup.functions";
import {
  buildMessageFn,
  enqueueMessagesFn,
  markSentFn,
  sendBulkMessagesFn,
  sendOutboxFn,
} from "@/lib/messaging.functions";
import type { BoardBucket } from "@/lib/followup.functions";

export const Route = createFileRoute("/app/followup")({
  component: FollowupPage,
  head: () => ({
    meta: [
      { title: "متابعة العملاء والديون | دفترك" },
      {
        name: "description",
        content: "لوحة متابعة احترافية للديون المستحقة والمتأخرة مع تذكيرات تلقائية عبر واتساب وتليجرام.",
      },
      { property: "og:title", content: "متابعة العملاء والديون | دفترك" },
      {
        property: "og:description",
        content: "تابع العملاء المتأخرين وأرسل تذكيرات منظمة تلقائياً من دفترك.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface Draft {
  bucket: BoardBucket;
  body: string;
  outboxId: string | null;
}

function FollowupPage() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useBoard();
  const board = data ?? EMPTY_BOARD;

  const [tab, setTab] = useState<FollowupTab>("pending");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);

  const buildMessage = useServerFn(buildMessageFn);
  const enqueueMessages = useServerFn(enqueueMessagesFn);
  const markSent = useServerFn(markSentFn);
  const sendOutbox = useServerFn(sendOutboxFn);
  const sendBulk = useServerFn(sendBulkMessagesFn);
  const runCycle = useServerFn(runFollowupCycleFn);

  const rows = useMemo(() => filterBuckets(board.buckets, tab, q), [board.buckets, tab, q]);
  const keyOf = (b: BoardBucket) => `${b.person_id}:${b.currency_id}`;

  const build = useMutation({
    mutationFn: (b: BoardBucket) =>
      buildMessage({ data: { person_id: b.person_id, currency_id: b.currency_id } }),
    onSuccess: (res, b) => setDraft({ bucket: b, body: res.body, outboxId: null }),
    onError: (e: Error) => toast.error(e.message),
  });

  const queueOne = useMutation({
    mutationFn: (d: Draft) =>
      buildMessage({
        data: { person_id: d.bucket.person_id, currency_id: d.bucket.currency_id, enqueue: true },
      }),
    onSuccess: async (res) => {
      if (res.outbox_id) await markSent({ data: { id: res.outbox_id } });
      toast.success("تم تسجيل التذكير في سجل المتابعة");
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["followup-board"] });
      void qc.invalidateQueries({ queryKey: ["outbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoSend = useMutation({
    mutationFn: async (d: Draft) => {
      const res = await buildMessage({
        data: { person_id: d.bucket.person_id, currency_id: d.bucket.currency_id, enqueue: true },
      });
      if (!res.outbox_id) throw new Error("تعذّر تجهيز الرسالة");
      return sendOutbox({ data: { id: res.outbox_id } });
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("تم الإرسال");
        setDraft(null);
      } else {
        toast.error(res.error ?? "فشل الإرسال");
      }
      void qc.invalidateQueries({ queryKey: ["followup-board"] });
      void qc.invalidateQueries({ queryKey: ["outbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedTargets = () =>
    board.buckets
      .filter((b) => selected.has(keyOf(b)))
      .map((b) => ({ person_id: b.person_id, currency_id: b.currency_id }));

  const afterBulk = () => {
    setSelected(new Set());
    void qc.invalidateQueries({ queryKey: ["followup-board"] });
    void qc.invalidateQueries({ queryKey: ["today-board"] });
    void qc.invalidateQueries({ queryKey: ["outbox"] });
  };

  /** Bulk queue only — messages wait in the outbox. */
  const bulk = useMutation({
    mutationFn: () => enqueueMessages({ data: { targets: selectedTargets(), channel: "whatsapp" } }),
    onSuccess: (res) => {
      toast.success(`تم إضافة ${res.queued} رسالة إلى الصادر`);
      afterBulk();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Bulk send now (auto) or bulk mark-as-sent (manual follow-up). */
  const bulkSend = useMutation({
    mutationFn: (mode: "send" | "manual") =>
      sendBulk({ data: { targets: selectedTargets(), channel: "whatsapp", mode } }),
    onSuccess: (res, mode) => {
      if (mode === "manual") toast.success(`تم تسجيل ${res.sent} تذكير كمُرسل`);
      else if (res.sent > 0)
        toast.success(`تم إرسال ${res.sent} رسالة${res.failed ? ` · فشل ${res.failed}` : ""}`);
      else toast.error(res.errors[0] ?? "تعذّر الإرسال — تحقق من إعدادات القنوات");
      afterBulk();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allSelected = rows.length > 0 && rows.every((b) => selected.has(keyOf(b)));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((b) => keyOf(b))));

  const cycle = useMutation({
    mutationFn: () => runCycle(),
    onSuccess: (s: { queued: number; sent: number }) => {
      toast.success(`تم الفحص: ${s.queued} رسالة جديدة، ${s.sent} مُرسلة`);
      void qc.invalidateQueries({ queryKey: ["followup-board"] });
      void qc.invalidateQueries({ queryKey: ["outbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (b: BoardBucket) => {
    const k = keyOf(b);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  return (
    <div className="space-y-2.5">
      <PageHeader
        icon={Target}
        title="متابعة العملاء"
        subtitle="لوحة محسوبة بالكامل في الواجهة الخلفية"
        back="/app"
      />

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] flex-1"
          onClick={() => cycle.mutate()}
          disabled={cycle.isPending}
        >
          {cycle.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          فحص وتجهيز التذكيرات
        </Button>
        <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
          <Link to="/app/outbox">
            <Inbox className="size-3" /> الصادر
          </Link>
        </Button>
      </div>

      <AtRiskBanner totals={board.totals} />
      <FollowupTabs tab={tab} counts={board.counts} onChange={setTab} />
      <SearchBar value={q} onChange={setQ} placeholder="ابحث باسم متقطع، رقم هاتف، أو مبلغ..." />

      {rows.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <button
            onClick={toggleAll}
            className="inline-flex items-center gap-1 text-[10.5px] font-bold text-primary"
          >
            <ListChecks className="size-3.5" />
            {allSelected ? "إلغاء تحديد الكل" : `تحديد الكل (${rows.length})`}
          </button>
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="inline-flex items-center gap-0.5 text-[10.5px] text-muted-foreground"
            >
              <X className="size-3" /> مسح التحديد
            </button>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-11 z-20 rounded-lg border-2 border-primary/40 bg-card/95 backdrop-blur p-2 space-y-1.5 shadow-elevated animate-in slide-in-from-top-1">
          <div className="text-[11px] font-black">
            الإرسال الجماعي — {selected.size} عميل
          </div>
          <div className="grid grid-cols-3 gap-1">
            <Button
              size="sm"
              className="h-7 text-[10.5px] bg-success text-success-foreground hover:bg-success/90"
              onClick={() => bulkSend.mutate("send")}
              disabled={bulkSend.isPending || !board.availability.whatsapp_auto}
              title={
                board.availability.whatsapp_auto
                  ? "إرسال فوري عبر القناة المفعّلة"
                  : "الإرسال التلقائي غير مفعّل في إعدادات القنوات"
              }
            >
              {bulkSend.isPending ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
              إرسال فوري
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10.5px]"
              onClick={() => bulk.mutate()}
              disabled={bulk.isPending}
            >
              {bulk.isPending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
              تجهيز بالصادر
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10.5px]"
              onClick={() => bulkSend.mutate("manual")}
              disabled={bulkSend.isPending}
            >
              <CheckCheck className="size-3" /> تسجيل كمُرسل
            </Button>
          </div>
          {!board.availability.whatsapp_auto && (
            <p className="text-[9px] text-muted-foreground">
              لتفعيل الإرسال الفوري: فعّل واتساب/تليجرام من الإعدادات ← القنوات.
            </p>
          )}
        </div>
      )}

      {isLoading || isFetching ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Target}
          title="لا يوجد عملاء بحاجة للمتابعة"
          description="كل الأرصدة منتظمة حالياً."
        />
      ) : (
        <div className="space-y-1.5">
          {rows.map((b) => (
            <FollowupCard
              key={keyOf(b)}
              bucket={b}
              selected={selected.has(keyOf(b))}
              canAuto={board.availability.whatsapp_auto}
              onSelect={() => toggle(b)}
              onMessage={() => build.mutate(b)}
              onAutoSend={() =>
                autoSend.mutate({ bucket: b, body: "", outboxId: null })
              }
            />
          ))}
        </div>
      )}

      {draft && (
        <MessageSheet
          name={draft.bucket.name}
          body={draft.body}
          loading={build.isPending}
          phone={draft.bucket.phone}
          canAuto={board.availability.whatsapp_auto}
          onBodyChange={(v) => setDraft({ ...draft, body: v })}
          onQueue={() => queueOne.mutate(draft)}
          onAutoSend={() => autoSend.mutate(draft)}
          onClose={() => setDraft(null)}
        />
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        آخر تحديث للوحة: {board.generated_at ? new Date(board.generated_at).toLocaleString("ar") : "—"}
        {" · "}
        <button className="underline" onClick={() => void refetch()}>
          تحديث
        </button>
      </p>
    </div>
  );
}
