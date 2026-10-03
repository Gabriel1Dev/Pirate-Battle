import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchMatchHistory,
  fetchRanking,
  submitMatch,
} from "./matches";
import type { MatchRecord } from "./contracts";
import type { GameConfig } from "../game/config";

export const matchQueryKeys = {
  all: ["matches"] as const,
  history: (playerId: string, page: number) =>
    ["matches", "history", playerId, page] as const,
  ranking: (page: number, config: GameConfig, scenario: string) =>
    ["ranking", page, config, scenario] as const,
};

export function useSubmitMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (match: MatchRecord) => submitMatch(match),
    retry: 2,
    retryDelay: 250,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: matchQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["ranking"] }),
      ]);
    },
  });
}

export function useRanking(
  page: number,
  config: GameConfig,
  enabled: boolean,
  scenario: string,
) {
  return useQuery({
    queryKey: matchQueryKeys.ranking(page, config, scenario),
    queryFn: () => fetchRanking(page, config),
    enabled,
    retry: 2,
    retryDelay: 250,
    staleTime: 15_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

export function useMatchHistory(
  playerId: string | null,
  page: number,
  enabled: boolean,
  scenario: string,
) {
  return useQuery({
    queryKey: playerId
      ? [...matchQueryKeys.history(playerId, page), scenario]
      : ["matches", "history", "anonymous", page, scenario],
    queryFn: () => fetchMatchHistory(playerId ?? "", page),
    enabled: enabled && playerId !== null,
    retry: 2,
    retryDelay: 250,
    staleTime: 15_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}
