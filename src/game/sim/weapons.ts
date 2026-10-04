import type { WeaponConfig } from "../config";
import type { GameState, InputState, Projectile } from "./types";

const QUARTER_TURN_RADIANS = Math.PI / 2;
const BROADSIDE_SHOT_INTERVAL_SEC = 0.08;

function createProjectile(
  state: GameState,
  angle: number,
  lateralOffset: number,
  weapon: WeaponConfig,
  shipAngle = state.player.angle,
): Projectile {
  const { player } = state;
  const forwardX = Math.cos(shipAngle);
  const forwardY = Math.sin(shipAngle);
  const muzzleDistance = player.radius + weapon.projectileRadius;
  const position = {
    x:
      player.pos.x +
      forwardX * muzzleDistance +
      forwardX * lateralOffset,
    y:
      player.pos.y +
      forwardY * muzzleDistance +
      forwardY * lateralOffset,
  };

  return {
    id: state.nextId++,
    owner: "player",
    pos: position,
    vel: {
      x: Math.cos(angle) * weapon.projectileSpeed,
      y: Math.sin(angle) * weapon.projectileSpeed,
    },
    damage: weapon.damage,
    ttl: weapon.projectileLifetimeSec,
    radius: weapon.projectileRadius,
  };
}

function fireFrontWeapon(state: GameState): void {
  const weapon = state.config.player.front;
  const projectile = createProjectile(
    state,
    state.player.angle,
    0,
    weapon,
  );

  state.projectiles.push(projectile);
  state.player.cooldowns.front = weapon.cooldownSec;
  state.stats.shotsFired += 1;
  state.events.push({
    type: "shot",
    pos: { ...projectile.pos },
    angle: state.player.angle,
    owner: "player",
  });
}

function fireBroadsideProjectile(
  state: GameState,
  angle: number,
  shipAngle: number,
  offset: number,
): void {
  const weapon = state.config.player.broadside;
  const projectile = createProjectile(
    state,
    angle,
    offset,
    weapon,
    shipAngle,
  );

  state.projectiles.push(projectile);
  state.stats.shotsFired += 1;
  state.events.push({
    type: "shot",
    pos: { ...projectile.pos },
    angle,
    owner: "player",
  });
}

function fireBroadside(
  state: GameState,
  side: "left" | "right",
): void {
  const weapon = state.config.player.broadside;
  const shipAngle = state.player.angle;
  const angle =
    shipAngle +
    (side === "left" ? -QUARTER_TURN_RADIANS : QUARTER_TURN_RADIANS);
  const centerOffset = (weapon.projectileCount - 1) / 2;
  const offsets = Array.from(
    { length: weapon.projectileCount },
    (_, index) => (index - centerOffset) * weapon.spacing,
  );
  if (side === "right") {
    offsets.reverse();
  }

  const firstOffset = offsets.shift();
  if (firstOffset === undefined) {
    return;
  }

  fireBroadsideProjectile(state, angle, shipAngle, firstOffset);
  state.pendingBroadsideSalvos[side] =
    offsets.length > 0
      ? {
          angle,
          shipAngle,
          offsets,
          timeUntilNextShotSec: BROADSIDE_SHOT_INTERVAL_SEC,
        }
      : null;
  state.player.cooldowns[side] = weapon.cooldownSec;
}

function updatePendingBroadsides(
  state: GameState,
  deltaSeconds: number,
): void {
  for (const side of ["left", "right"] as const) {
    const salvo = state.pendingBroadsideSalvos[side];
    if (!salvo) {
      continue;
    }

    salvo.timeUntilNextShotSec -= deltaSeconds;
    while (salvo.timeUntilNextShotSec <= 0 && salvo.offsets.length > 0) {
      const offset = salvo.offsets.shift();
      if (offset === undefined) {
        break;
      }

      fireBroadsideProjectile(state, salvo.angle, salvo.shipAngle, offset);
      salvo.timeUntilNextShotSec += BROADSIDE_SHOT_INTERVAL_SEC;
    }

    if (salvo.offsets.length === 0) {
      state.pendingBroadsideSalvos[side] = null;
    }
  }
}

export function updatePlayerWeapons(
  state: GameState,
  input: InputState,
  deltaSeconds: number,
): void {
  const cooldowns = state.player.cooldowns;
  cooldowns.front = Math.max(0, cooldowns.front - deltaSeconds);
  cooldowns.left = Math.max(0, cooldowns.left - deltaSeconds);
  cooldowns.right = Math.max(0, cooldowns.right - deltaSeconds);

  if (input.fireFront && cooldowns.front === 0) {
    fireFrontWeapon(state);
  }
  updatePendingBroadsides(state, deltaSeconds);
  if (input.fireLeft && cooldowns.left === 0) {
    fireBroadside(state, "left");
  }
  if (input.fireRight && cooldowns.right === 0) {
    fireBroadside(state, "right");
  }
}
