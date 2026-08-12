import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTodayFn, type TodayPayload } from "@/lib/today.functions";
import { useAuth } from "@/lib/auth";

export interface TodayAvailability {
  whatsapp_auto: boolean;
  telegram: boolean;
  sms: boolean;
}

export type TodayData = TodayPayload & { availability: TodayAvailability };

export const EMPTY_TODAY: TodayData = {
  tasks: [],
  counts: {
    all: 0,
    due_today: 0,
    overdue: 0,
    promise_due: 0,
    promise_broken: 0,
    failed_message: 0,
    pending: 0,
    reminded: 0,
  },
  totals: [],
  collected_today: [],
  generated_at: "",
  availability: { whatsapp_auto: false, telegram: false, sms: false },
};

/** The workspace is computed server-side; the hook only reads it. */
export function useToday() {
  const getToday = useServerFn(getTodayFn);
  const { user } = useAuth();
  const uid = user?.id;
  return useQuery({
    queryKey: ["today-board", uid],
    queryFn: () => getToday() as Promise<TodayData>,
    enabled: !!uid,
    staleTime: 30_000,
  });
}
