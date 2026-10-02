import type { WeaponConfig } from "../config";
import { nextRandom } from "./rng";
import { canShipOccupy, distanceSquared } from "./geometry";
import type { GameState, Ship, ShipKind, Vec2 } from "./types";

const FULL_TURN_RADIANS = Math.PI * 2;

function rotateToward(
  currentAngle: number,
  targetAngle: number,
  maximumTurn: number,
): number {
  const difference =
    ((targetAngle - currentAngle + Math.PI) % FULL_TURN_RADIANS +
      FULL_TURN_RADIANS) %
      FULL_TURN_RADIANS -
    Math.PI;
  return currentAngle + Math.max(-maximumTurn, Math.min(maximumTurn, difference));
}

function moveForward(
  state: GameState,
  ship: Ship,
  speed: number,
  deltaSeconds: number,
): void {
  const candidate: Vec2 = {
    x: ship.pos.x + Math.cos(ship.angle) * speed * deltaSeconds,
    y: ship.pos.y + Math.sin(ship.angle) * speed * deltaSeconds,
  };

  if (canShipOccupy(ship, candidate, state)) {
    ship.pos = candidate;
  }
}

function fireAtPlayer(
  state: GameState,
  enemy: Ship,
  weapon: WeaponConfig,
): void {
  const angle = enemy.angle;
  const position = {
    x:
      enemy.pos.x +
      Math.cos(angle) * (enemy.radius + weapon.projectileRadius),
    y:
      enemy.pos.y +
      Math.sin(angle) * (enemy.radius + weapon.projectileRadius),
  };

  state.projectiles.push({
    id: state.nextId++,
    owner: "enemy",
    pos: position,
    vel: {
      x: Math.cos(angle) * weapon.projectileSpeed,
      y: Math.sin(angle) * weapon.projectileSpeed,
    },
    damage: weapon.damage,
    ttl: weapon.projectileLifetimeSec,
    radius: weapon.projectileRadius,
  });
  enemy.cooldowns.front = weapon.cooldownSec;
  state.stats.shotsFired += 1;
  state.events.push({
    type: "shot",
    pos: { ...position },
    angle,
    owner: "enemy",
  });
}

export function updateEnemies(
  state: GameState,
  deltaSeconds: number,
): void {
  for (const enemy of state.enemies) {
    const dx = state.player.pos.x - enemy.pos.x;
    const dy = state.player.pos.y - enemy.pos.y;
    const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);
    const targetAngle = Math.atan2(dy, dx);

    if (enemy.kind === "chaser") {
      enemy.angle = rotateToward(
        enemy.angle,
        targetAngle,
        state.config.chaser.turnSpeed * deltaSeconds,
      );
      moveForward(state, enemy, state.config.chaser.speed, deltaSeconds);
      continue;
    }

    const { shooter } = state.config;
    enemy.angle = rotateToward(
      enemy.angle,
      targetAngle,
      shooter.turnSpeed * deltaSeconds,
    );
    if (distanceToPlayer > shooter.keepDistance) {
      moveForward(state, enemy, shooter.speed, deltaSeconds);
    }

    enemy.cooldowns.front = Math.max(
      0,
      enemy.cooldowns.front - deltaSeconds,
    );
    if (
      distanceToPlayer <= shooter.attackRange &&
      enemy.cooldowns.front === 0
    ) {
      fireAtPlayer(state, enemy, shooter.weapon);
    }
  }
}

function consumeRandom(state: GameState): number {
  const result = nextRandom(state.rngState);
  state.rngState = result.nextState;
  return result.value;
}

function chooseEnemyKind(state: GameState): Exclude<ShipKind, "player"> {
  const { chaser, shooter } = state.config.spawn.weights;
  const totalWeight = chaser + shooter;

  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    throw new RangeError("Enemy spawn weights must have a positive total.");
  }

  return consumeRandom(state) * totalWeight < chaser ? "chaser" : "shooter";
}

function createEnemy(
  state: GameState,
  kind: Exclude<ShipKind, "player">,
  position: Vec2,
): Ship {
  const config = kind === "chaser" ? state.config.chaser : state.config.shooter;
  const angle = Math.atan2(
    state.player.pos.y - position.y,
    state.player.pos.x - position.x,
  );

  return {
    id: state.nextId++,
    kind,
    pos: position,
    angle,
    hp: config.maxHp,
    maxHp: config.maxHp,
    radius: config.radius,
    cooldowns: {
      front: 0,
      left: 0,
      right: 0,
    },
  };
}

function isSpawnPositionFree(
  state: GameState,
  position: Vec2,
  radius: number,
): boolean {
  if (!canShipOccupy({ ...state.player, radius }, position, state)) {
    return false;
  }

  const minimumPlayerDistance =
    state.config.spawn.minDistanceFromPlayer + radius;
  if (
    distanceSquared(position, state.player.pos) <
    minimumPlayerDistance * minimumPlayerDistance
  ) {
    return false;
  }

  return state.enemies.every((enemy) => {
    const combinedRadius = enemy.radius + radius;
    return distanceSquared(position, enemy.pos) >= combinedRadius * combinedRadius;
  });
}

function trySpawnEnemy(state: GameState): void {
  const kind = chooseEnemyKind(state);
  const config = kind === "chaser" ? state.config.chaser : state.config.shooter;
  const { arena, spawn } = state.config;
  const minX = spawn.edgeMargin + config.radius;
  const minY = spawn.edgeMargin + config.radius;
  const maxX = arena.width - minX;
  const maxY = arena.height - minY;

  if (maxX < minX || maxY < minY) {
    return;
  }

  for (let attempt = 0; attempt < spawn.maxAttempts; attempt += 1) {
    const position = {
      x: minX + consumeRandom(state) * (maxX - minX),
      y: minY + consumeRandom(state) * (maxY - minY),
    };

    if (isSpawnPositionFree(state, position, config.radius)) {
      state.enemies.push(createEnemy(state, kind, position));
      state.stats.enemiesSpawned += 1;
      return;
    }
  }
}

export function updateEnemySpawning(
  state: GameState,
  deltaSeconds: number,
): void {
  const interval = state.config.match.spawnIntervalSec;
  if (
    !Number.isFinite(interval) ||
    interval < state.config.step.fixedStepSec
  ) {
    throw new RangeError(
      "Enemy spawn interval must be at least one simulation timestep.",
    );
  }

  state.spawnTimerSec -= deltaSeconds;
  if (
    state.spawnTimerSec > 0 &&
    state.spawnTimerSec <= state.config.step.fixedStepSec * 1e-9
  ) {
    state.spawnTimerSec = 0;
  }
  while (state.spawnTimerSec <= 0) {
    trySpawnEnemy(state);
    state.spawnTimerSec += interval;
  }
}
