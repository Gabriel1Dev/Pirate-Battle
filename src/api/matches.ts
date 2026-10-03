import { apiClient } from "./client";
import type { GameConfig } from "../game/config";
import type {
  MatchRecord,
  MatchRecordResponse,
  PageResult,
  RankingEntry,
} from "./contracts";

const PAGE_SIZE = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMatchRecord(value: unknown): value is MatchRecord {
  return (
    isRecord(value) &&
    typeof value.matchId === "string" &&
    typeof value.playerId === "string" &&
    typeof value.completedAt === "string" &&
    Number.isFinite(Date.parse(value.completedAt)) &&
    typeof value.score === "number" &&
    Number.isFinite(value.score) &&
    typeof value.durationSec === "number" &&
    Number.isFinite(value.durationSec) &&
    (value.endReason === "time" || value.endReason === "death") &&
    isRecord(value.config)
  );
}

function isPageResult<T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): value is PageResult<T> {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isItem) &&
    Number.isInteger(value.page) &&
    Number(value.page) > 0 &&
    Number.isInteger(value.pageSize) &&
    Number(value.pageSize) > 0 &&
    Number.isInteger(value.totalItems) &&
    Number(value.totalItems) >= 0 &&
    Number.isInteger(value.totalPages) &&
    Number(value.totalPages) >= 0
  );
}

function isRankingEntry(value: unknown): value is RankingEntry {
  return isMatchRecord(value) && isRecord(value) && typeof value.playerName === "string";
}

export async function submitMatch(match: MatchRecord): Promise<MatchRecord> {
  const response = await apiClient.post<MatchRecordResponse>(
    "/matches",
    match,
    { headers: { "Idempotency-Key": match.matchId } },
  );
  const responseData: unknown = response.data;
  if (!isRecord(responseData) || !isMatchRecord(responseData.match)) {
    throw new Error("The match service returned an invalid submission response.");
  }
  return responseData.match;
}

export async function fetchRanking(
  page: number,
  config: GameConfig,
): Promise<PageResult<RankingEntry>> {
  const response = await apiClient.get<PageResult<RankingEntry>>("/ranking", {
    params: { page, pageSize: PAGE_SIZE, config: JSON.stringify(config) },
  });
  const responseData: unknown = response.data;
  if (!isPageResult(responseData, isRankingEntry)) {
    throw new Error("The ranking service returned an invalid page.");
  }
  return response.data;
}

export async function fetchMatchHistory(
  playerId: string,
  page: number,
): Promise<PageResult<MatchRecord>> {
  const response = await apiClient.get<PageResult<MatchRecord>>("/matches", {
    params: { playerId, page, pageSize: PAGE_SIZE },
  });
  const responseData: unknown = response.data;
  if (!isPageResult(responseData, isMatchRecord)) {
    throw new Error("The match history service returned an invalid page.");
  }
  return response.data;
}
