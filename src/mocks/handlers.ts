import { http, HttpResponse, delay } from "msw";
import type {
  MatchRecord,
  PageResult,
  RankingEntry,
} from "../api/contracts";
import { RANKING_FIXTURES } from "./fixtures";
import { getNetworkScenario } from "./scenarios";

const MOCK_MATCHES_KEY = "pirate-battle.mock-matches.v1";
const TIMEOUT_SAVES_KEY = "pirate-battle.mock-timeout-saves.v1";

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

function readMockMatches(): MatchRecord[] {
  const value = window.localStorage.getItem(MOCK_MATCHES_KEY);
  if (value === null) {
    return [];
  }

  const parsed: unknown = JSON.parse(value);
  if (
    !Array.isArray(parsed) ||
    !parsed.every((entry: unknown) => isMatchRecord(entry))
  ) {
    throw new Error("The local mock match database is invalid.");
  }
  return parsed;
}

function saveMockMatches(matches: readonly MatchRecord[]): void {
  window.localStorage.setItem(MOCK_MATCHES_KEY, JSON.stringify(matches));
}

function parsePagination(url: URL): { page: number; pageSize: number } | null {
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "5");
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 50
  ) {
    return null;
  }
  return { page, pageSize };
}

function parseConfig(url: URL): unknown {
  const serializedConfig = url.searchParams.get("config");
  if (!serializedConfig) {
    return null;
  }
  try {
    return JSON.parse(serializedConfig) as unknown;
  } catch {
    return null;
  }
}

function paginate<T>(items: readonly T[], page: number, pageSize: number): PageResult<T> {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems: items.length,
    totalPages: Math.ceil(items.length / pageSize),
  };
}

function compareRankingEntries(left: RankingEntry, right: RankingEntry): number {
  return (
    right.score - left.score ||
    left.durationSec - right.durationSec ||
    left.completedAt.localeCompare(right.completedAt) ||
    left.matchId.localeCompare(right.matchId)
  );
}

async function applyReadScenario(
  route: "ranking" | "history",
  page: number,
): Promise<Response | null> {
  const scenario = getNetworkScenario();
  if (
    scenario === `${route}-fail` ||
    scenario === "http-5xx"
  ) {
    return HttpResponse.json(
      { message: `The ${route} service is temporarily unavailable.` },
      { status: 503 },
    );
  }
  if (scenario === "http-4xx") {
    return HttpResponse.json(
      { message: "The requested page is not available." },
      { status: 400 },
    );
  }
  if (scenario === "timeout") {
    await delay(5000);
  } else if (scenario === "slow") {
    await delay(1700);
  } else if (scenario === "variable-latency") {
    await delay(page % 2 === 0 ? 150 : 1150);
  }
  return null;
}

export const handlers = [
  http.get("/api/ranking", async ({ request }) => {
    const url = new URL(request.url);
    const pagination = parsePagination(url);
    const requestedConfig = parseConfig(url);
    if (!pagination || !isRecord(requestedConfig)) {
      return HttpResponse.json(
        { message: "Valid pagination and match configuration are required." },
        { status: 400 },
      );
    }

    const scenarioResponse = await applyReadScenario(
      "ranking",
      pagination.page,
    );
    if (scenarioResponse) {
      return scenarioResponse;
    }
    if (getNetworkScenario() === "empty") {
      return HttpResponse.json(paginate([], pagination.page, pagination.pageSize));
    }

    let submittedEntries: RankingEntry[];
    try {
      submittedEntries = readMockMatches().map((match) => ({
        ...match,
        playerName: match.playerId === "local-player" ? "You" : "Player",
      }));
    } catch {
      return HttpResponse.json(
        { message: "The local mock ranking could not be read." },
        { status: 500 },
      );
    }

    const entries = [
      ...RANKING_FIXTURES,
      ...submittedEntries,
    ].filter(
      (entry, index, all) =>
        JSON.stringify(entry.config) === JSON.stringify(requestedConfig) &&
        all.findIndex((candidate) => candidate.matchId === entry.matchId) === index,
    );
    entries.sort(compareRankingEntries);
    return HttpResponse.json(
      paginate(entries, pagination.page, pagination.pageSize),
    );
  }),

  http.get("/api/matches", async ({ request }) => {
    const url = new URL(request.url);
    const pagination = parsePagination(url);
    const playerId = url.searchParams.get("playerId");
    if (!pagination || !playerId) {
      return HttpResponse.json(
        { message: "A player ID and valid pagination are required." },
        { status: 400 },
      );
    }

    const scenarioResponse = await applyReadScenario(
      "history",
      pagination.page,
    );
    if (scenarioResponse) {
      return scenarioResponse;
    }
    if (getNetworkScenario() === "empty") {
      return HttpResponse.json(paginate([], pagination.page, pagination.pageSize));
    }

    try {
      const matches = readMockMatches()
        .filter((match) => match.playerId === playerId)
        .sort(
          (left, right) =>
            right.completedAt.localeCompare(left.completedAt) ||
            left.matchId.localeCompare(right.matchId),
        );
      return HttpResponse.json(
        paginate(matches, pagination.page, pagination.pageSize),
      );
    } catch {
      return HttpResponse.json(
        { message: "The local mock history could not be read." },
        { status: 500 },
      );
    }
  }),

  http.post("/api/matches", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (!isMatchRecord(body) || idempotencyKey !== body.matchId) {
      return HttpResponse.json(
        { message: "A valid match and matching idempotency key are required." },
        { status: 400 },
      );
    }

    const scenario = getNetworkScenario();
    if (scenario === "offline-on-finish") {
      return HttpResponse.json(
        { message: "Match submission is temporarily offline." },
        { status: 503 },
      );
    }
    if (scenario === "http-4xx") {
      return HttpResponse.json(
        { message: "The match submission was rejected." },
        { status: 422 },
      );
    }
    if (scenario === "http-5xx") {
      return HttpResponse.json(
        { message: "The match service is temporarily unavailable." },
        { status: 503 },
      );
    }
    if (scenario === "timeout") {
      await delay(5000);
      return HttpResponse.json(
        { message: "The match submission timed out." },
        { status: 504 },
      );
    }

    let matches: MatchRecord[];
    try {
      matches = readMockMatches();
    } catch {
      return HttpResponse.json(
        { message: "The local mock match database could not be read." },
        { status: 500 },
      );
    }

    const existingMatch = matches.find((match) => match.matchId === body.matchId);
    if (existingMatch) {
      return HttpResponse.json({ match: existingMatch, created: false });
    }

    const updatedMatches = [...matches, body];
    try {
      saveMockMatches(updatedMatches);
    } catch {
      return HttpResponse.json(
        { message: "The mock match could not be persisted." },
        { status: 500 },
      );
    }

    if (scenario === "timeout-after-save") {
      const savedIdsValue: unknown = JSON.parse(
        window.localStorage.getItem(TIMEOUT_SAVES_KEY) ?? "[]",
      );
      if (
        !Array.isArray(savedIdsValue) ||
        !savedIdsValue.every((value: unknown) => typeof value === "string")
      ) {
        return HttpResponse.json(
          { message: "The timeout scenario state is invalid." },
          { status: 500 },
        );
      }
      const savedTimeoutIds = new Set<string>(savedIdsValue);
      if (!savedTimeoutIds.has(body.matchId)) {
        savedTimeoutIds.add(body.matchId);
        window.localStorage.setItem(
          TIMEOUT_SAVES_KEY,
          JSON.stringify([...savedTimeoutIds]),
        );
        await delay(5000);
      }
    } else if (scenario === "slow") {
      await delay(1700);
    } else if (scenario === "variable-latency") {
      await delay(700);
    }

    return HttpResponse.json(
      { match: body, created: true },
      { status: 201 },
    );
  }),
];
