import type { GameState } from "./types";

export function pauseGame(currentState: GameState): GameState {
  if (currentState.status !== "running") {
    return currentState;
  }

  return {
    ...currentState,
    status: "paused",
    accumulatorSec: 0,
    events: [],
  };
}

export function resumeGame(currentState: GameState): GameState {
  if (currentState.status !== "paused") {
    return currentState;
  }

  return {
    ...currentState,
    status: "running",
    accumulatorSec: 0,
    events: [],
  };
}
