import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Shield, AlertTriangle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { analyzeCustomerRating } from "@/lib/customer-rating.functions";
import { fmtDate } from "@/lib/format";

interface Props {
  personId: string;
}

const RATING_META: Record<
  string,
  { label: string; color: string; ring: string; icon: typeof Shield }
> = {
  excellent: {
    label: "ممتاز",
    color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300",
    ring: "ring-emerald-500",
    icon: Shield,
  },
  very_good: {
    label: "جيد جداً",
    color: "text-green-700 bg-green-50 dark:bg-green-950/40 dark:text-green-300",
    ring: "ring-green-500",
    icon: TrendingUp,
  },
  good: {
    label: "جيد",
    color: "text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300",
    ring: "ring-blue-500",
    icon: TrendingUp,
  },
  average: {
    label: "متوسط",
    color: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300",
    ring: "ring-amber-500",
    icon: AlertTriangle,
  },
  high_risk: {
    label: "مرتفع المخاطر",
    color: "text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300",
    ring: "ring-red-500",
    icon: AlertTriangle,
  },
};

export function CustomerHealthCard({ personId }: Props) {
  const [rating, setRating] = useState<{
    score: number;
    rating: string;
    reason: string | null;
    computed_at: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const analyze = useServerFn(analyzeCustomerRating);

  const load = async () => {
    const { data } = await supabase
      .from("customer_ratings")
      .select("score,rating,reason,computed_at")
      .eq("person_id", personId)
      .maybeSingle();
    setRating(data as never);
  };
  useEffect(() => {
    load();
  }, [personId]);

  const run = async () => {
    setLoading(true);
    try {
      await analyze({ data: { person_id: personId } });
      toast.success("تم تحليل العميل");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التحليل");
    } finally {
      setLoading(false);
    }
  };

  const meta = rating ? (RATING_META[rating.rating] ?? RATING_META.average) : null;
  const Icon = meta?.icon ?? Shield;

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-muted-foreground">
          تقييم العميل بالذكاء الاصطناعي
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={run}
          disabled={loading}
          className="h-7 gap-1 text-xs"
        >
          <Sparkles className="size-3.5" />
          {rating ? "إعادة التحليل" : "تحليل الآن"}
        </Button>
      </div>

      {!rating ? (
        <div className="text-xs text-muted-foreground py-2">
          اضغط "تحليل الآن" ليُقيّم الذكاء الاصطناعي انتظام سداد هذا العميل وسلوكه المالي.
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div
            className={`relative size-14 rounded-full grid place-items-center ring-2 ${meta?.ring} bg-background`}
          >
            <div className="text-lg font-bold leading-none">{rating.score}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta?.color}`}
            >
              <Icon className="size-3" />
              {meta?.label}
            </div>
            {rating.reason && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-3">{rating.reason}</div>
            )}
            <div className="text-[10px] text-muted-foreground mt-1">
              آخر تحليل: {fmtDate(rating.computed_at)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
