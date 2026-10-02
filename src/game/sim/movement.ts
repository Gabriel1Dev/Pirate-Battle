import type { GameState, InputState, Vec2 } from "./types";
import { canShipOccupy } from "./geometry";

export function movePlayer(
  state: GameState,
  input: InputState,
  deltaSeconds: number,
): void {
  const { player } = state;
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
  if (canShipOccupy(player, candidatePosition, state)) {
    player.pos = candidatePosition;
  }
}
