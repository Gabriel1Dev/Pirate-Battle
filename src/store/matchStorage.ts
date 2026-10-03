import type { GameConfig } from "../game/config";
import type { MatchRecord } from "../api/contracts";

const MATCH_STORAGE_KEY = "pirate-battle.matches.v1";
const STORAGE_VERSION = 1;

export type MatchResultDraft = Omit<MatchRecord, "playerId">;

export interface StoredMatchRecord extends MatchRecord {
  readonly submissionStatus: "pending" | "confirmed";
}

export interface StoredMatches {
  readonly playerId: string | null;
  readonly matches: readonly StoredMatchRecord[];
}

export interface StoredMatchesResult {
  readonly matches: StoredMatches;
  readonly error: string | null;
}

interface PersistedMatches {
  readonly version: typeof STORAGE_VERSION;
  readonly playerId: string;
  readonly matches: readonly StoredMatchRecord[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isVec2(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y)
  );
}

function isShipConfig(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.maxHp) &&
    isFiniteNumber(value.speed) &&
    isFiniteNumber(value.turnSpeed) &&
    isFiniteNumber(value.radius)
  );
}

function isWeaponConfig(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.cooldownSec) &&
    isFiniteNumber(value.damage) &&
    isFiniteNumber(value.projectileSpeed) &&
    isFiniteNumber(value.projectileLifetimeSec) &&
    isFiniteNumber(value.projectileRadius)
  );
}

function isGameConfig(value: unknown): value is GameConfig {
  if (!isRecord(value)) {
    return false;
  }

  const {
    step,
    match,
    scoring,
    arena,
    player,
    chaser,
    shooter,
    spawn,
    visual,
  } = value;

  return (
    isRecord(step) &&
    isFiniteNumber(step.fixedStepSec) &&
    isFiniteNumber(step.maxFrameSec) &&
    isRecord(match) &&
    isFiniteNumber(match.durationSec) &&
    isFiniteNumber(match.spawnIntervalSec) &&
    isRecord(scoring) &&
    isFiniteNumber(scoring.pointsPerEnemy) &&
    isRecord(arena) &&
    isFiniteNumber(arena.width) &&
    isFiniteNumber(arena.height) &&
    isVec2(arena.playerStart) &&
    isFiniteNumber(arena.playerStartAngle) &&
    Array.isArray(arena.islands) &&
    arena.islands.every(
      (island: unknown) =>
        isRecord(island) &&
        isFiniteNumber(island.x) &&
        isFiniteNumber(island.y) &&
        isFiniteNumber(island.radius),
    ) &&
    isRecord(player) &&
    isShipConfig(player) &&
    isWeaponConfig(player.front) &&
    isRecord(player.broadside) &&
    isWeaponConfig(player.broadside) &&
    isFiniteNumber(player.broadside.projectileCount) &&
    isFiniteNumber(player.broadside.spacing) &&
    isRecord(chaser) &&
    isShipConfig(chaser) &&
    isFiniteNumber(chaser.contactDamage) &&
    isRecord(shooter) &&
    isShipConfig(shooter) &&
    isFiniteNumber(shooter.attackRange) &&
    isFiniteNumber(shooter.keepDistance) &&
    isWeaponConfig(shooter.weapon) &&
    isRecord(spawn) &&
    isFiniteNumber(spawn.minDistanceFromPlayer) &&
    isFiniteNumber(spawn.edgeMargin) &&
    isFiniteNumber(spawn.maxAttempts) &&
    isRecord(spawn.weights) &&
    isFiniteNumber(spawn.weights.chaser) &&
    isFiniteNumber(spawn.weights.shooter) &&
    isRecord(visual) &&
    Array.isArray(visual.damageStages) &&
    visual.damageStages.every(isFiniteNumber) &&
    isFiniteNumber(visual.shotEffectDurationSec) &&
    isFiniteNumber(visual.hitEffectDurationSec) &&
    isFiniteNumber(visual.explosionEffectDurationSec) &&
    isFiniteNumber(visual.shotEffectSize) &&
    isFiniteNumber(visual.hitEffectSize) &&
    isFiniteNumber(visual.explosionEffectSize) &&
    isFiniteNumber(visual.effectStartScale) &&
    isFiniteNumber(visual.effectEndScale)
  );
}

function isStoredMatchRecord(value: unknown): value is StoredMatchRecord {
  return (
    isRecord(value) &&
    typeof value.matchId === "string" &&
    value.matchId.length > 0 &&
    typeof value.playerId === "string" &&
    value.playerId.length > 0 &&
    typeof value.completedAt === "string" &&
    Number.isFinite(Date.parse(value.completedAt)) &&
    isFiniteNumber(value.score) &&
    isFiniteNumber(value.durationSec) &&
    (value.endReason === "time" || value.endReason === "death") &&
    isGameConfig(value.config) &&
    (value.submissionStatus === "pending" ||
      value.submissionStatus === "confirmed")
  );
}

function isPersistedMatches(value: unknown): value is PersistedMatches {
  return (
    isRecord(value) &&
    value.version === STORAGE_VERSION &&
    typeof value.playerId === "string" &&
    value.playerId.length > 0 &&
    Array.isArray(value.matches) &&
    value.matches.every(
      (match: unknown) =>
        isStoredMatchRecord(match) && match.playerId === value.playerId,
    )
  );
}

function createUuid(): string {
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function createMatchId(): string {
  return createUuid();
}

export function readStoredMatches(): StoredMatchesResult {
  try {
    const storedValue = window.localStorage.getItem(MATCH_STORAGE_KEY);
    if (storedValue === null) {
      return {
        matches: { playerId: null, matches: [] },
        error: null,
      };
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    if (!isPersistedMatches(parsedValue)) {
      return {
        matches: { playerId: null, matches: [] },
        error: "Saved match records are invalid and were not changed.",
      };
    }

    return {
      matches: {
        playerId: parsedValue.playerId,
        matches: [...parsedValue.matches],
      },
      error: null,
    };
  } catch (error: unknown) {
    return {
      matches: { playerId: null, matches: [] },
      error:
        error instanceof Error
          ? `Match records could not be loaded: ${error.message}`
          : "Match records could not be loaded from this browser.",
    };
  }
}

export function savePendingMatch(draft: MatchResultDraft): StoredMatches {
  const storedResult = readStoredMatches();
  if (storedResult.error) {
    throw new Error(storedResult.error);
  }

  const existingMatch = storedResult.matches.matches.find(
    (match) => match.matchId === draft.matchId,
  );
  if (existingMatch) {
    return storedResult.matches;
  }

  const playerId = storedResult.matches.playerId ?? createUuid();
  const match: StoredMatchRecord = {
    ...draft,
    playerId,
    config: structuredClone(draft.config),
    submissionStatus: "pending",
  };
  const persistedMatches: PersistedMatches = {
    version: STORAGE_VERSION,
    playerId,
    matches: [...storedResult.matches.matches, match],
  };

  window.localStorage.setItem(
    MATCH_STORAGE_KEY,
    JSON.stringify(persistedMatches),
  );

  return { playerId, matches: [...persistedMatches.matches] };
}

export function markMatchConfirmed(matchId: string): StoredMatches {
  const storedResult = readStoredMatches();
  if (storedResult.error) {
    throw new Error(storedResult.error);
  }
  const match = storedResult.matches.matches.find(
    (candidate) => candidate.matchId === matchId,
  );
  if (!match || match.submissionStatus === "confirmed") {
    return storedResult.matches;
  }

  const matches = storedResult.matches.matches.map((candidate) =>
    candidate.matchId === matchId
      ? { ...candidate, submissionStatus: "confirmed" as const }
      : candidate,
  );
  const playerId = storedResult.matches.playerId;
  if (!playerId) {
    throw new Error("The stored match is missing its player ID.");
  }
  const persistedMatches: PersistedMatches = {
    version: STORAGE_VERSION,
    playerId,
    matches,
  };
  window.localStorage.setItem(
    MATCH_STORAGE_KEY,
    JSON.stringify(persistedMatches),
  );
  return { playerId, matches };
}

export function getPendingMatches(
  matches: StoredMatches,
): readonly StoredMatchRecord[] {
  return matches.matches.filter(
    (match) => match.submissionStatus === "pending",
  );
}
