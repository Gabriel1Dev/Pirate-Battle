import type { GameConfig } from "../game/config";
import type { EndReason } from "../game/sim/types";

export interface MatchRecord {
  readonly matchId: string;
  readonly playerId: string;
  readonly completedAt: string;
  readonly score: number;
  readonly durationSec: number;
  readonly endReason: EndReason;
  readonly config: GameConfig;
}

export interface RankingEntry extends MatchRecord {
  readonly playerName: string;
}

export interface PageResult<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface MatchRecordResponse {
  readonly match: MatchRecord;
  readonly created: boolean;
}
