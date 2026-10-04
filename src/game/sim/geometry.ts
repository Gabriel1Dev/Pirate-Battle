import type { GameState, Ship, Vec2 } from "./types";

function distanceSquaredToSegment(
  point: Vec2,
  start: Vec2,
  end: Vec2,
): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  const projection =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - start.x) * segmentX +
              (point.y - start.y) * segmentY) /
              lengthSquared,
          ),
        );
  const nearestX = start.x + projection * segmentX;
  const nearestY = start.y + projection * segmentY;
  const deltaX = point.x - nearestX;
  const deltaY = point.y - nearestY;
  return deltaX * deltaX + deltaY * deltaY;
}

function isPointInsidePolygon(point: Vec2, vertices: readonly Vec2[]): boolean {
  let inside = false;
  for (
    let current = 0, previous = vertices.length - 1;
    current < vertices.length;
    previous = current, current += 1
  ) {
    const first = vertices[current];
    const second = vertices[previous];
    if (!first || !second) {
      continue;
    }
    const crosses =
      first.y > point.y !== second.y > point.y &&
      point.x <
        ((second.x - first.x) * (point.y - first.y)) /
          (second.y - first.y) +
          first.x;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

function segmentCircleIntersection(
  start: Vec2,
  end: Vec2,
  center: Vec2,
  radius: number,
): number | undefined {
  const directionX = end.x - start.x;
  const directionY = end.y - start.y;
  const offsetX = start.x - center.x;
  const offsetY = start.y - center.y;
  const a = directionX * directionX + directionY * directionY;
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius;
  if (c <= 0) {
    return 0;
  }
  if (a === 0) {
    return undefined;
  }

  const b = 2 * (offsetX * directionX + offsetY * directionY);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return undefined;
  }
  const progress = (-b - Math.sqrt(discriminant)) / (2 * a);
  return progress >= 0 && progress <= 1 ? progress : undefined;
}

export function distanceSquared(first: Vec2, second: Vec2): number {
  const x = first.x - second.x;
  const y = first.y - second.y;
  return x * x + y * y;
}

export function overlapsIsland(
  position: Vec2,
  radius: number,
  state: GameState,
): boolean {
  return state.islands.some((island) => {
    const outline = island.outline;
    if (isPointInsidePolygon(position, outline)) {
      return true;
    }

    const combinedRadiusSquared = radius * radius;
    return outline.some((point, pointIndex) => {
      const nextPoint = outline[(pointIndex + 1) % outline.length];
      return (
        nextPoint !== undefined &&
        distanceSquaredToSegment(position, point, nextPoint) <=
          combinedRadiusSquared
      );
    });
  });
}

export function segmentIntersectsIsland(
  start: Vec2,
  end: Vec2,
  island: GameState["islands"][number],
  expansionRadius = 0,
): number | undefined {
  const outline = island.outline;
  const expansionRadiusSquared = expansionRadius * expansionRadius;
  if (
    isPointInsidePolygon(start, outline) ||
    outline.some((point, pointIndex) => {
      const nextPoint = outline[(pointIndex + 1) % outline.length];
      return (
        nextPoint !== undefined &&
        distanceSquaredToSegment(start, point, nextPoint) <=
          expansionRadiusSquared
      );
    })
  ) {
    return 0;
  }

  const directionX = end.x - start.x;
  const directionY = end.y - start.y;
  let earliestIntersection: number | undefined;
  for (let pointIndex = 0; pointIndex < outline.length; pointIndex += 1) {
    const first = outline[pointIndex];
    const second = outline[(pointIndex + 1) % outline.length];
    if (!first || !second) {
      continue;
    }
    const edgeX = second.x - first.x;
    const edgeY = second.y - first.y;
    const denominator = directionX * edgeY - directionY * edgeX;
    const offsetX = first.x - start.x;
    const offsetY = first.y - start.y;
    if (denominator !== 0) {
      const segmentProgress =
        (offsetX * edgeY - offsetY * edgeX) / denominator;
      const edgeProgress =
        (offsetX * directionY - offsetY * directionX) / denominator;
      if (
        segmentProgress >= 0 &&
        segmentProgress <= 1 &&
        edgeProgress >= 0 &&
        edgeProgress <= 1 &&
        (earliestIntersection === undefined ||
          segmentProgress < earliestIntersection)
      ) {
        earliestIntersection = segmentProgress;
      }
    }

    if (expansionRadius > 0) {
      const edgeLength = Math.hypot(edgeX, edgeY);
      if (edgeLength === 0) {
        continue;
      }
      const normalX = -edgeY / edgeLength;
      const normalY = edgeX / edgeLength;
      const signedStartDistance = offsetX * normalX + offsetY * normalY;
      const signedTravelDistance =
        directionX * normalX + directionY * normalY;
      if (signedTravelDistance !== 0) {
        for (const side of [-1, 1]) {
          const progress =
            (side * expansionRadius - signedStartDistance) /
            signedTravelDistance;
          if (progress < 0 || progress > 1) {
            continue;
          }
          const contactX = start.x + directionX * progress;
          const contactY = start.y + directionY * progress;
          const edgeProgress =
            ((contactX - first.x) * edgeX + (contactY - first.y) * edgeY) /
            (edgeLength * edgeLength);
          if (
            edgeProgress >= 0 &&
            edgeProgress <= 1 &&
            (earliestIntersection === undefined ||
              progress < earliestIntersection)
          ) {
            earliestIntersection = progress;
          }
        }
      }

      for (const endpoint of [first, second]) {
        const progress = segmentCircleIntersection(
          start,
          end,
          endpoint,
          expansionRadius,
        );
        if (
          progress !== undefined &&
          (earliestIntersection === undefined ||
            progress < earliestIntersection)
        ) {
          earliestIntersection = progress;
        }
      }
    }
  }
  return earliestIntersection;
}

export function isWithinArena(
  position: Vec2,
  radius: number,
  state: GameState,
): boolean {
  return (
    position.x >= radius &&
    position.x <= state.config.arena.width - radius &&
    position.y >= radius &&
    position.y <= state.config.arena.height - radius
  );
}

export function canShipOccupy(
  ship: Ship,
  position: Vec2,
  state: GameState,
): boolean {
  return (
    isWithinArena(position, ship.radius, state) &&
    !overlapsIsland(position, ship.radius, state)
  );
}
