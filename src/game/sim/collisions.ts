import { distanceSquared } from "./geometry";
import type { GameState } from "./types";

export function resolveShipCollisions(state: GameState): void {
  const chasers = state.enemies.filter((enemy) => enemy.kind === "chaser");
  const collidedChaserIds = new Set<number>();

  for (const chaser of chasers) {
    const combinedRadius = chaser.radius + state.player.radius;
    if (
      distanceSquared(chaser.pos, state.player.pos) >=
      combinedRadius * combinedRadius
    ) {
      continue;
    }

    const appliedDamage = Math.min(
      state.player.hp,
      state.config.chaser.contactDamage,
    );
    state.player.hp -= appliedDamage;
    state.stats.damageTaken += appliedDamage;
    collidedChaserIds.add(chaser.id);
    state.events.push({
      type: "hit",
      pos: { ...state.player.pos },
      target: "player",
    });
    state.events.push({
      type: "explosion",
      pos: { ...chaser.pos },
      kind: "chaser",
    });
  }

  state.enemies = state.enemies.filter(
    (enemy) => !collidedChaserIds.has(enemy.id),
  );

  if (state.player.hp === 0) {
    state.status = "ended";
    state.endReason = "death";
  }
}
