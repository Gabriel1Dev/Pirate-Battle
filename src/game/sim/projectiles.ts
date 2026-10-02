import type { GameState, Projectile, Vec2 } from "./types";

function segmentIntersectsCircle(
  start: Vec2,
  end: Vec2,
  center: Vec2,
  radius: number,
): boolean {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  const projection =
    segmentLengthSquared === 0
      ? 0
      : Math.min(
          1,
          Math.max(
            0,
            ((center.x - start.x) * segmentX +
              (center.y - start.y) * segmentY) /
              segmentLengthSquared,
          ),
        );
  const closestX = start.x + projection * segmentX;
  const closestY = start.y + projection * segmentY;
  const dx = closestX - center.x;
  const dy = closestY - center.y;

  return dx * dx + dy * dy <= radius * radius;
}

function isInsideArena(
  position: Vec2,
  radius: number,
  width: number,
  height: number,
): boolean {
  return (
    position.x + radius >= 0 &&
    position.x - radius <= width &&
    position.y + radius >= 0 &&
    position.y - radius <= height
  );
}

function hitsIsland(
  projectile: Projectile,
  nextPosition: Vec2,
  state: GameState,
): boolean {
  return state.islands.some((island) =>
    segmentIntersectsCircle(
      projectile.pos,
      nextPosition,
      island.pos,
      island.radius + projectile.radius,
    ),
  );
}

export function updateProjectiles(
  state: GameState,
  deltaSeconds: number,
): void {
  const { arena } = state.config;
  const remainingProjectiles: Projectile[] = [];

  for (const projectile of state.projectiles) {
    const nextPosition: Vec2 = {
      x: projectile.pos.x + projectile.vel.x * deltaSeconds,
      y: projectile.pos.y + projectile.vel.y * deltaSeconds,
    };
    const expired = projectile.ttl <= deltaSeconds;
    const outsideArena = !isInsideArena(
      nextPosition,
      projectile.radius,
      arena.width,
      arena.height,
    );
    const islandImpact = hitsIsland(projectile, nextPosition, state);

    if (expired || outsideArena || islandImpact) {
      if (islandImpact) {
        state.events.push({
          type: "hit",
          pos: nextPosition,
          target: "island",
        });
      }
      continue;
    }

    projectile.pos = nextPosition;
    projectile.ttl -= deltaSeconds;
    remainingProjectiles.push(projectile);
  }

  state.projectiles = remainingProjectiles;
}
