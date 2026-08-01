import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFollowupBoardFn } from "@/lib/followup.functions";
import type { BoardBucket, FollowupBoard, Severity } from "@/lib/followup.functions";

export type FollowupTab = "all" | "critical" | "late" | "due" | "soon";

export type BoardPayload = FollowupBoard & {
  availability: { whatsapp: boolean; telegram: boolean; sms: boolean };
};

export const EMPTY_BOARD: BoardPayload = {
  buckets: [],
  counts: { all: 0, critical: 0, late: 0, due: 0, soon: 0 },
  totals: [],
  policy: null,
  channels: null,
  generated_at: "",
  availability: { whatsapp: false, telegram: false, sms: false },
};

/** Reads the whole board from the backend. No client-side scoring. */
export function useBoard() {
  const fetchBoard = useServerFn(getFollowupBoardFn);
  return useQuery({
    queryKey: ["followup-board"],
    queryFn: () => fetchBoard() as Promise<BoardPayload>,
    staleTime: 30_000,
  });
}

export function filterBuckets(buckets: BoardBucket[], tab: FollowupTab, q: string) {
  const term = q.trim().toLowerCase();
  return buckets.filter((b) => {
    if (tab !== "all" && b.severity !== (tab as Severity)) return false;
    if (!term) return true;
    return b.name.toLowerCase().includes(term) || (b.phone ?? "").includes(term);
  });
}
