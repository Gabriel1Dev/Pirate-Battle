import type { GameState, Projectile, Vec2 } from "./types";

interface Impact {
  readonly amount: number;
  readonly target: "player" | "enemy" | "island";
  readonly position: Vec2;
  readonly shipId?: number;
}

function segmentCircleIntersection(
  start: Vec2,
  end: Vec2,
  center: Vec2,
  radius: number,
): number | undefined {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const offsetX = start.x - center.x;
  const offsetY = start.y - center.y;
  const a = segmentX * segmentX + segmentY * segmentY;
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius;

  if (c <= 0) {
    return 0;
  }
  if (a === 0) {
    return undefined;
  }

  const b = 2 * (offsetX * segmentX + offsetY * segmentY);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return undefined;
  }

  const intersection = (-b - Math.sqrt(discriminant)) / (2 * a);
  return intersection >= 0 && intersection <= 1 ? intersection : undefined;
}

function getImpact(
  projectile: Projectile,
  start: Vec2,
  end: Vec2,
  state: GameState,
  destroyedEnemyIds: ReadonlySet<number>,
): Impact | undefined {
  let earliestImpact: Impact | undefined;

  const considerImpact = (
    amount: number | undefined,
    target: Impact["target"],
    shipId?: number,
  ): void => {
    if (
      amount !== undefined &&
      (earliestImpact === undefined || amount < earliestImpact.amount)
    ) {
      earliestImpact = {
        amount,
        target,
        position: {
          x: start.x + (end.x - start.x) * amount,
          y: start.y + (end.y - start.y) * amount,
        },
        shipId,
      };
    }
  };

  for (const island of state.islands) {
    considerImpact(
      segmentCircleIntersection(
        start,
        end,
        island.pos,
        island.radius + projectile.radius,
      ),
      "island",
    );
  }

  if (projectile.owner === "player") {
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || destroyedEnemyIds.has(enemy.id)) {
        continue;
      }
      considerImpact(
        segmentCircleIntersection(
          start,
          end,
          enemy.pos,
          enemy.radius + projectile.radius,
        ),
        "enemy",
        enemy.id,
      );
    }
  } else {
    considerImpact(
      segmentCircleIntersection(
        start,
        end,
        state.player.pos,
        state.player.radius + projectile.radius,
      ),
      "player",
      state.player.id,
    );
  }

  return earliestImpact;
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

function applyImpact(
  state: GameState,
  projectile: Projectile,
  impact: Impact,
  destroyedEnemyIds: Set<number>,
): void {
  state.events.push({
    type: "hit",
    pos: impact.position,
    target: impact.target,
  });

  if (impact.target === "island") {
    return;
  }

  if (impact.target === "player") {
    const appliedDamage = Math.min(state.player.hp, projectile.damage);
    state.player.hp -= appliedDamage;
    state.stats.damageTaken += appliedDamage;
    return;
  }

  const enemy = state.enemies.find((candidate) => candidate.id === impact.shipId);
  if (!enemy || enemy.hp <= 0) {
    return;
  }

  enemy.hp = Math.max(0, enemy.hp - projectile.damage);
  if (enemy.hp === 0) {
    destroyedEnemyIds.add(enemy.id);
    state.score += state.config.scoring.pointsPerEnemy;
    state.stats.enemiesDestroyed += 1;
    state.events.push({
      type: "explosion",
      pos: { ...enemy.pos },
      kind: enemy.kind,
    });
  }
}

export function updateProjectiles(
  state: GameState,
  deltaSeconds: number,
): void {
  const { arena } = state.config;
  const remainingProjectiles: Projectile[] = [];
  const destroyedEnemyIds = new Set<number>();

  for (const projectile of state.projectiles) {
    const movementSeconds = Math.min(deltaSeconds, projectile.ttl);
    const nextPosition: Vec2 = {
      x: projectile.pos.x + projectile.vel.x * movementSeconds,
      y: projectile.pos.y + projectile.vel.y * movementSeconds,
    };
    const impact = getImpact(
      projectile,
      projectile.pos,
      nextPosition,
      state,
      destroyedEnemyIds,
    );

    if (impact) {
      applyImpact(state, projectile, impact, destroyedEnemyIds);
      continue;
    }

    const expired = projectile.ttl <= deltaSeconds;
    const outsideArena = !isInsideArena(
      nextPosition,
      projectile.radius,
      arena.width,
      arena.height,
    );

    if (expired || outsideArena) {
      continue;
    }

    projectile.pos = nextPosition;
    projectile.ttl -= deltaSeconds;
    remainingProjectiles.push(projectile);
  }

  state.enemies = state.enemies.filter(
    (enemy) => !destroyedEnemyIds.has(enemy.id),
  );
  state.projectiles = remainingProjectiles;
}
