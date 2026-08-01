import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTodayFn, type TodayPayload } from "@/lib/today.functions";

export const EMPTY_TODAY: TodayPayload = {
  tasks: [],
  counts: { all: 0, due_today: 0, overdue: 0, promise_due: 0, promise_broken: 0, failed_message: 0 },
  totals: [],
  collected_today: [],
  generated_at: "",
};

/** The workspace is computed server-side; the hook only reads it. */
export function useToday() {
  const getToday = useServerFn(getTodayFn);
  return useQuery({
    queryKey: ["today-board"],
    queryFn: () => getToday(),
    staleTime: 30_000,
  });
}
