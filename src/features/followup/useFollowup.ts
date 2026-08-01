import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ensureNotificationPermission, notify } from "@/lib/push";
import {
  atRiskTotals, buildBuckets,
  type Bucket, type FollowupPerson, type UnpaidTx,
} from "@/lib/followup/severity";

export type FollowupTab = "all" | "critical" | "late" | "soon";

/** Loads unpaid debts, groups them into scored buckets, and raises daily alerts. */
export function useFollowup() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [tab, setTab] = useState<FollowupTab>("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: tx }, { data: pp }] = await Promise.all([
      supabase
        .from("transactions")
        .select("id,person_id,amount,direction,currency_code,due_date,is_paid,occurred_at,details")
        .eq("is_paid", false),
      supabase.from("people").select("id,name,phone,credit_limit").eq("is_archived", false),
    ]);
    setBuckets(buildBuckets((tx ?? []) as unknown as UnpaidTx[], (pp ?? []) as FollowupPerson[]));
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  // Local notification for critical/late buckets, once per day.
  useEffect(() => {
    if (loading || buckets.length === 0) return;
    const crit = buckets.filter((b) => b.severity === "critical" || b.severity === "late");
    if (crit.length === 0) return;
    const key = `followup-notified-${new Date().toDateString()}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void ensureNotificationPermission().then((ok) => {
      if (ok) {
        notify(
          "ديون متأخرة تستدعي المتابعة",
          `لديك ${crit.length} عميل متأخر — راجع صفحة المتابعة الذكية.`,
          "/app/followup",
          "followup-daily",
        );
      }
    });
  }, [loading, buckets]);

  const counts = useMemo(() => ({
    all: buckets.length,
    critical: buckets.filter((b) => b.severity === "critical").length,
    late: buckets.filter((b) => b.severity === "late").length,
    soon: buckets.filter((b) => b.severity === "soon").length,
  }), [buckets]);

  const filtered = useMemo(
    () => (tab === "all" ? buckets : buckets.filter((b) => b.severity === tab)),
    [buckets, tab],
  );

  const totalAtRisk = useMemo(() => atRiskTotals(buckets), [buckets]);

  return { loading, buckets, filtered, counts, totalAtRisk, tab, setTab, reload: load };
}
