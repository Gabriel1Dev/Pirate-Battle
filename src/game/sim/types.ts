import type { GameConfig, IslandConfig } from "../config";

export type EntityId = number;

export interface Vector2 {
  x: number;
  y: number;
}

export interface InputState {
  readonly moveForward: boolean;
  readonly rotateLeft: boolean;
  readonly rotateRight: boolean;
  readonly fireFront: boolean;
  readonly fireBroadsideLeft: boolean;
  readonly fireBroadsideRight: boolean;
}

export type MatchStatus = "ready" | "playing" | "paused" | "finished";

export type MatchEndReason = "time-expired" | "player-destroyed";

export type EnemyKind = "chaser" | "shooter";

export type ProjectileOwner = "player" | "enemy";

export type WeaponKind = "player-front" | "player-broadside" | "enemy-shooter";

export interface ShipState {
  id: EntityId;
  position: Vector2;
  rotationRadians: number;
  radius: number;
  health: number;
  maximumHealth: number;
}

export interface PlayerState extends ShipState {
  frontWeaponCooldownSeconds: number;
  broadsideWeaponCooldownSeconds: number;
}

export interface ChaserState extends ShipState {
  kind: "chaser";
}

export interface ShooterState extends ShipState {
  kind: "shooter";
  weaponCooldownSeconds: number;
}

export type EnemyState = ChaserState | ShooterState;

export interface ProjectileState {
  id: EntityId;
  owner: ProjectileOwner;
  weapon: WeaponKind;
  position: Vector2;
  velocity: Vector2;
  rotationRadians: number;
  radius: number;
  damage: number;
  remainingLifetimeSeconds: number;
  remainingRange: number;
}

export type IslandState = IslandConfig;

export interface GameState {
  status: MatchStatus;
  endReason: MatchEndReason | null;
  elapsedSeconds: number;
  remainingSeconds: number;
  score: number;
  rngState: number;
  nextEntityId: EntityId;
  spawnCooldownSeconds: number;
  configSnapshot: GameConfig;
  player: PlayerState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  islands: IslandState[];
}
