import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { BellRing, CheckCircle2 } from "lucide-react";
import { useFollowup } from "@/features/followup/useFollowup";
import {
  useReminderDraft,
  openWhatsApp,
  quickReminderText,
} from "@/features/followup/useReminderDraft";
import { FollowupTabs } from "@/features/followup/FollowupTabs";
import { AtRiskBanner } from "@/features/followup/AtRiskBanner";
import { FollowupCard } from "@/features/followup/FollowupCard";
import { AiDraftSheet } from "@/features/followup/AiDraftSheet";

export const Route = createFileRoute("/app/followup")({
  head: () => ({
    meta: [
      { title: "المتابعة الذكية — دفترك" },
      {
        name: "description",
        content: "متابعة الديون المتأخرة وتذكير العملاء بمساعدة الذكاء الاصطناعي.",
      },
      { property: "og:title", content: "المتابعة الذكية — دفترك" },
      {
        property: "og:description",
        content: "متابعة الديون المتأخرة وتذكير العملاء بمساعدة الذكاء الاصطناعي.",
      },
    ],
  }),
  component: FollowupPage,
});

function FollowupPage() {
  const { loading, filtered, counts, totalAtRisk, tab, setTab } = useFollowup();
  const draft = useReminderDraft();

  return (
    <div className="space-y-3">
      <PageHeader
        icon={BellRing}
        title="المتابعة الذكية"
        subtitle="تذكير وإدارة الديون المتأخرة بمساعدة الذكاء الاصطناعي"
      />

      <FollowupTabs tab={tab} counts={counts} onChange={setTab} />
      <AtRiskBanner totals={totalAtRisk} />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="لا يوجد ما يستوجب المتابعة"
          description="جميع العملاء ضمن الحدود الآمنة. أحسنت!"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <FollowupCard
              key={`${b.person.id}-${b.currency}`}
              bucket={b}
              onDraft={(x) => void draft.generate(x, "polite")}
              onQuickWhatsApp={(x) => openWhatsApp(x, quickReminderText(x))}
            />
          ))}
        </div>
      )}

      {draft.draftFor && (
        <AiDraftSheet
          bucket={draft.draftFor}
          text={draft.text}
          loading={draft.loading}
          onTextChange={draft.setText}
          onTone={(t) => void draft.generate(draft.draftFor!, t)}
          onSend={() => {
            openWhatsApp(draft.draftFor!, draft.text);
            draft.close();
          }}
          onClose={draft.close}
        />
      )}
    </div>
  );
}
