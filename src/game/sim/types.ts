import type { GameConfig, Vec2 } from "../config";

export type { Vec2 };

export type ShipKind = "player" | "chaser" | "shooter";
export type ProjectileOwner = "player" | "enemy";
export type EndReason = "time" | "death";
export type GameStatus = "running" | "paused" | "ended";

export interface Cooldowns {
  front: number; // seconds remaining
  left: number;
  right: number;
}

export interface Ship {
  id: number;
  kind: ShipKind;
  pos: Vec2;
  angle: number; // radians, 0 = +x
  hp: number;
  maxHp: number;
  radius: number;
  cooldowns: Cooldowns;
}

export interface Projectile {
  id: number;
  owner: ProjectileOwner;
  pos: Vec2;
  vel: Vec2;
  damage: number;
  ttl: number; // seconds remaining
  radius: number;
}

export interface Island {
  pos: Vec2;
  radius: number;
  outline: readonly Vec2[];
}

export interface InputState {
  forward: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  fireFront: boolean;
  fireLeft: boolean;
  fireRight: boolean;
}

export const EMPTY_INPUT: Readonly<InputState> = {
  forward: false,
  turnLeft: false,
  turnRight: false,
  fireFront: false,
  fireLeft: false,
  fireRight: false,
};

/** One-shot facts for render/sound. Cleared by the consumer each frame. */
export type GameEvent =
  | { type: "shot"; pos: Vec2; angle: number; owner: ProjectileOwner }
  | { type: "hit"; pos: Vec2; target: "player" | "enemy" | "island" }
  | { type: "explosion"; pos: Vec2; kind: ShipKind };

export interface GameStats {
  shotsFired: number;
  enemiesSpawned: number;
  enemiesDestroyed: number;
  damageTaken: number;
}

export interface GameState {
  readonly seed: number;
  readonly config: GameConfig; // match snapshot
  status: GameStatus;
  endReason?: EndReason;

  elapsedSec: number; // active play time
  timeLeftSec: number;
  accumulatorSec: number;
  score: number;

  player: Ship;
  enemies: Ship[];
  projectiles: Projectile[];
  islands: readonly Island[];

  spawnTimerSec: number;
  nextId: number;
  rngState: number;

  events: GameEvent[];
  stats: GameStats;
}

/** What the HUD and the semantic UI need (small, copied at ~10 Hz). */
export interface HudSnapshot {
  score: number;
  timeLeftSec: number;
  hp: number;
  maxHp: number;
  status: GameStatus;
  endReason?: EndReason;
}
