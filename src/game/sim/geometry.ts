import type { GameState, Ship, Vec2 } from "./types";

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
    const combinedRadius = radius + island.radius;
    return (
      distanceSquared(position, island.pos) <
      combinedRadius * combinedRadius
    );
  });
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
