import type { GameState, InputState, Vec2 } from "./types";

function overlapsIsland(
  position: Vec2,
  shipRadius: number,
  state: GameState,
): boolean {
  return state.islands.some((island) => {
    const dx = position.x - island.pos.x;
    const dy = position.y - island.pos.y;
    const combinedRadius = shipRadius + island.radius;

    return dx * dx + dy * dy < combinedRadius * combinedRadius;
  });
}

export function movePlayer(
  state: GameState,
  input: InputState,
  deltaSeconds: number,
): void {
  const { player } = state;
  const { arena } = state.config;
  const originalPosition = player.pos;
  const turnDirection =
    Number(input.turnRight) - Number(input.turnLeft);

  player.angle += turnDirection * state.config.player.turnSpeed * deltaSeconds;

  if (!input.forward) {
    return;
  }

  const distance = state.config.player.speed * deltaSeconds;
  const candidatePosition: Vec2 = {
    x: originalPosition.x + Math.cos(player.angle) * distance,
    y: originalPosition.y + Math.sin(player.angle) * distance,
  };
  const boundedPosition: Vec2 = {
    x: Math.min(
      arena.width - player.radius,
      Math.max(player.radius, candidatePosition.x),
    ),
    y: Math.min(
      arena.height - player.radius,
      Math.max(player.radius, candidatePosition.y),
    ),
  };

  if (!overlapsIsland(boundedPosition, player.radius, state)) {
    player.pos = boundedPosition;
  }
}
