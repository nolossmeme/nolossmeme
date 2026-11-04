import { useQuery } from "@tanstack/react-query";

import { indexer, indexerEnabled } from "../lib/indexer";

export function usePoolActivity(pool: string | undefined) {
  return useQuery({
    queryKey: ["indexer", "activity", pool],
    queryFn: () => indexer.poolActivity(pool ?? ""),
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

export function useRecentActivity() {
  return useQuery({
    queryKey: ["indexer", "recent"],
    queryFn: () => indexer.recent(20),
    enabled: indexerEnabled,
    refetchInterval: 20_000,
  });
}
