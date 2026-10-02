import type { WeaponConfig } from "../config";
import type { GameState, InputState, Projectile } from "./types";

const QUARTER_TURN_RADIANS = Math.PI / 2;

function createProjectile(
  state: GameState,
  angle: number,
  lateralOffset: number,
  weapon: WeaponConfig,
): Projectile {
  const { player } = state;
  const forwardX = Math.cos(player.angle);
  const forwardY = Math.sin(player.angle);
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

function fireBroadside(
  state: GameState,
  side: "left" | "right",
): void {
  const weapon = state.config.player.broadside;
  const sideAngle =
    state.player.angle +
    (side === "left" ? -QUARTER_TURN_RADIANS : QUARTER_TURN_RADIANS);
  const centerOffset = (weapon.projectileCount - 1) / 2;

  for (let index = 0; index < weapon.projectileCount; index += 1) {
    const offset = (index - centerOffset) * weapon.spacing;
    const projectile = createProjectile(
      state,
      sideAngle,
      offset,
      weapon,
    );

    state.projectiles.push(projectile);
    state.stats.shotsFired += 1;
    state.events.push({
      type: "shot",
      pos: { ...projectile.pos },
      angle: sideAngle,
      owner: "player",
    });
  }

  state.player.cooldowns[side] = weapon.cooldownSec;
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
  if (input.fireLeft && cooldowns.left === 0) {
    fireBroadside(state, "left");
  }
  if (input.fireRight && cooldowns.right === 0) {
    fireBroadside(state, "right");
  }
}
