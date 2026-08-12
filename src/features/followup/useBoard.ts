import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFollowupBoardFn } from "@/lib/followup.functions";
import type { BoardBucket, FollowupBoard, Severity } from "@/lib/followup.functions";
import { smartMatch } from "@/lib/search/match";
import { useAuth } from "@/lib/auth";

export type FollowupTab = "pending" | "reminded" | "all" | "critical" | "late" | "due" | "soon";

export interface Availability {
  whatsapp_auto: boolean;
  telegram: boolean;
  sms: boolean;
}

export type BoardPayload = FollowupBoard & { availability: Availability };

export const EMPTY_BOARD: BoardPayload = {
  buckets: [],
  counts: { all: 0, critical: 0, late: 0, due: 0, soon: 0, pending: 0, reminded: 0 },
  totals: [],
  policy: null,
  channels: null,
  generated_at: "",
  availability: { whatsapp_auto: false, telegram: false, sms: false },
};

/** Reads the whole board from the backend. No client-side scoring. */
export function useBoard() {
  const fetchBoard = useServerFn(getFollowupBoardFn);
  const { user } = useAuth();
  const uid = user?.id;
  return useQuery({
    queryKey: ["followup-board", uid],
    queryFn: () => fetchBoard() as Promise<BoardPayload>,
    enabled: !!uid,
    staleTime: 30_000,
  });
}

export function filterBuckets(buckets: BoardBucket[], tab: FollowupTab, q: string) {
  return buckets.filter((b) => {
    if (tab === "pending" && b.reminded) return false;
    if (tab === "reminded" && !b.reminded) return false;
    if (
      tab !== "all" &&
      tab !== "pending" &&
      tab !== "reminded" &&
      b.severity !== (tab as Severity)
    )
      return false;
    return smartMatch(q, {
      text: [b.name, b.currency_name],
      phones: [b.phone],
      numbers: [Math.round(b.net)],
    });
  });
}
