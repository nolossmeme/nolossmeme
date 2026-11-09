import { useQuery } from "@tanstack/react-query";

import { client } from "../lib/client";

export function usePoolState(pool: string | undefined) {
  return useQuery({
    queryKey: ["pool", pool, "state"],
    queryFn: () => client.getPoolState(pool ?? ""),
    enabled: Boolean(pool),
    refetchInterval: 15_000,
  });
}

export function useDraws(pool: string | undefined) {
  return useQuery({
    queryKey: ["pool", pool, "draws"],
    queryFn: () => client.getDraws(pool ?? "", 0, 200),
    enabled: Boolean(pool),
    refetchInterval: 30_000,
  });
}

export function useDepositors(pool: string | undefined) {
  return useQuery({
    queryKey: ["pool", pool, "depositors"],
    queryFn: () => client.getDepositors(pool ?? "", 0, 100),
    enabled: Boolean(pool),
    refetchInterval: 30_000,
  });
}

export function useMyPosition(pool: string | undefined, accountId: string | undefined) {
  return useQuery({
    queryKey: ["pool", pool, "account", accountId],
    queryFn: () => client.getAccount(pool ?? "", accountId ?? ""),
    enabled: Boolean(pool && accountId),
    refetchInterval: 15_000,
  });
}

export function useStNearPrice() {
  return useQuery({
    queryKey: ["stNearPrice"],
    queryFn: () => client.getStNearPrice(),
    staleTime: 60_000,
  });
}

export function usePending(pool: string | undefined, accountId: string | undefined) {
  return useQuery({
    queryKey: ["pool", pool, "pending", accountId],
    queryFn: () => client.getPending(pool ?? "", accountId ?? ""),
    enabled: Boolean(pool && accountId),
    refetchInterval: 30_000,
  });
}
