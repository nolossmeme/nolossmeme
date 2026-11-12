import { useQuery } from "@tanstack/react-query";

import { client } from "../lib/client";

export function useMemes() {
  return useQuery({
    queryKey: ["memes"],
    queryFn: () => client.getAllMemes(),
    refetchInterval: 30_000,
  });
}

export function useMeme(slug: string | undefined) {
  return useQuery({
    queryKey: ["meme", slug],
    queryFn: () => client.getMeme(slug ?? ""),
    enabled: Boolean(slug),
  });
}

export function useLaunchCost() {
  return useQuery({
    queryKey: ["launchCost"],
    queryFn: () => client.getLaunchCost(),
    staleTime: 60_000,
  });
}
