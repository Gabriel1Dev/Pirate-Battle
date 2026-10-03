import { DEFAULT_CONFIG } from "../game/config";
import type { RankingEntry } from "../api/contracts";

const FIXTURE_COMPLETION_DATE = "2026-01-01T12:00:00.000Z";

export const RANKING_FIXTURES: readonly RankingEntry[] = [
  {
    matchId: "fixture-match-01",
    playerId: "fixture-player-01",
    playerName: "Captain Rowan",
    completedAt: FIXTURE_COMPLETION_DATE,
    score: 18,
    durationSec: 180,
    endReason: "time",
    config: structuredClone(DEFAULT_CONFIG),
  },
  {
    matchId: "fixture-match-02",
    playerId: "fixture-player-02",
    playerName: "Mara Tide",
    completedAt: FIXTURE_COMPLETION_DATE,
    score: 14,
    durationSec: 151.2,
    endReason: "death",
    config: structuredClone(DEFAULT_CONFIG),
  },
  {
    matchId: "fixture-match-03",
    playerId: "fixture-player-03",
    playerName: "Old Salt",
    completedAt: FIXTURE_COMPLETION_DATE,
    score: 12,
    durationSec: 180,
    endReason: "time",
    config: structuredClone(DEFAULT_CONFIG),
  },
  {
    matchId: "fixture-match-04",
    playerId: "fixture-player-04",
    playerName: "Nina North",
    completedAt: FIXTURE_COMPLETION_DATE,
    score: 9,
    durationSec: 127.5,
    endReason: "death",
    config: structuredClone(DEFAULT_CONFIG),
  },
  {
    matchId: "fixture-match-05",
    playerId: "fixture-player-05",
    playerName: "Blue Jack",
    completedAt: FIXTURE_COMPLETION_DATE,
    score: 6,
    durationSec: 94.8,
    endReason: "death",
    config: structuredClone(DEFAULT_CONFIG),
  },
  {
    matchId: "fixture-match-06",
    playerId: "fixture-player-06",
    playerName: "Sable",
    completedAt: FIXTURE_COMPLETION_DATE,
    score: 3,
    durationSec: 71.4,
    endReason: "death",
    config: structuredClone(DEFAULT_CONFIG),
  },
];
