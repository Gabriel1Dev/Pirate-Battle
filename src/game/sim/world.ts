import { DEFAULT_CONFIG, type GameConfig } from "../config";
import { getIslandOutline } from "../islandShape";
import type { GameState, Island, Ship } from "./types";

const PLAYER_ID = 1;
const FIRST_ENTITY_ID = 2;

export function createInitialGameState(
  seed: number,
  config: GameConfig = DEFAULT_CONFIG,
): GameState {
  if (!Number.isInteger(seed)) {
    throw new RangeError("The game seed must be a finite integer.");
  }

  const normalizedSeed = seed >>> 0;
  const configSnapshot = structuredClone(config);
  const player: Ship = {
    id: PLAYER_ID,
    kind: "player",
    pos: { ...configSnapshot.arena.playerStart },
    angle: configSnapshot.arena.playerStartAngle,
    hp: configSnapshot.player.maxHp,
    maxHp: configSnapshot.player.maxHp,
    radius: configSnapshot.player.radius,
    cooldowns: {
      front: 0,
      left: 0,
      right: 0,
    },
  };
  const islands: Island[] = configSnapshot.arena.islands.map(
    (island, index) => {
      const pos = { x: island.x, y: island.y };
      return {
        pos,
        radius: island.radius,
        outline: getIslandOutline(island.radius, index).map((point) => ({
          x: point.x + pos.x,
          y: point.y + pos.y,
        })),
      };
    },
  );

  return {
    seed: normalizedSeed,
    config: configSnapshot,
    status: "running",
    elapsedSec: 0,
    timeLeftSec: configSnapshot.match.durationSec,
    accumulatorSec: 0,
    score: 0,
    player,
    enemies: [],
    projectiles: [],
    pendingBroadsideSalvos: {
      left: null,
      right: null,
    },
    islands,
    spawnTimerSec: configSnapshot.match.spawnIntervalSec,
    nextId: FIRST_ENTITY_ID,
    rngState: normalizedSeed,
    events: [],
    stats: {
      shotsFired: 0,
      enemiesSpawned: 0,
      enemiesDestroyed: 0,
      damageTaken: 0,
    },
  };
}
