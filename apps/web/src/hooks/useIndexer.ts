import { useQuery } from "@tanstack/react-query";

import { indexer, indexerEnabled } from "../lib/indexer";

export function usePoolActivity(pool: string | undefined) {
  return useQuery({
    queryKey: ["indexer", "activity", pool],
    queryFn: () => indexer.poolActivity(pool ?? "", 200),
    enabled: indexerEnabled && Boolean(pool),
    refetchInterval: 20_000,
  });
}

export function usePoolSeries(pool: string | undefined, hours = 24 * 7) {
  return useQuery({
    queryKey: ["indexer", "series", pool, hours],
    queryFn: () => indexer.series(pool ?? "", hours),
    enabled: indexerEnabled && Boolean(pool),
    refetchInterval: 60_000,
  });
}

export function useAccountActivity(accountId: string | undefined) {
  return useQuery({
    queryKey: ["indexer", "account", accountId],
    queryFn: () => indexer.account(accountId ?? "", 200),
    enabled: indexerEnabled && Boolean(accountId),
    refetchInterval: 30_000,
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ["indexer", "recent"],
    queryFn: () => indexer.recent(200),
    enabled: indexerEnabled,
    refetchInterval: 20_000,
  });
}
