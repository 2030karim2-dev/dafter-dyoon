import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchPending, type PendingItem } from "@/lib/notifications";

/**
 * Single source of truth for pending reminder/overdue alerts.
 * Feeds both the header bell and the bottom-nav badge so the
 * displayed count is always consistent across the UI.
 */
export function usePendingAlerts() {
  const { user } = useAuth();
  const uid = user?.id;
  const query = useQuery<PendingItem[]>({
    queryKey: ["pending-alerts", uid],
    queryFn: () => fetchPending(uid!),
    enabled: !!uid,
    refetchInterval: 5 * 60 * 1000,
  });
  const items = query.data ?? [];
  return { items, count: items.length, isLoading: query.isLoading, refetch: query.refetch };
}
