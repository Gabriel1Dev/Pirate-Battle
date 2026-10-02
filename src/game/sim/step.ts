import type { GameEvent, GameState, InputState } from "./types";
import { movePlayer } from "./movement";
import { updateProjectiles } from "./projectiles";
import { updatePlayerWeapons } from "./weapons";
import { resolveShipCollisions } from "./collisions";
import { updateEnemies, updateEnemySpawning } from "./enemies";

export function stepGame(
  currentState: GameState,
  input: InputState,
): GameState {
  if (currentState.status === "ended") {
    return currentState;
  }

  const state = structuredClone(currentState);
  const deltaSeconds = state.config.step.fixedStepSec;

  state.events = [];
  state.elapsedSec = Math.min(
    state.config.match.durationSec,
    state.elapsedSec + deltaSeconds,
  );
  state.timeLeftSec = Math.max(
    0,
    state.config.match.durationSec - state.elapsedSec,
  );

  movePlayer(state, input, deltaSeconds);
  updatePlayerWeapons(state, input, deltaSeconds);
  updateEnemies(state, deltaSeconds);
  updateEnemySpawning(state, deltaSeconds);
  updateProjectiles(state, deltaSeconds);
  resolveShipCollisions(state);

  if (state.status === "running" && state.timeLeftSec === 0) {
    state.status = "ended";
    state.endReason = "time";
  }

  return state;
}

export function advanceGame(
  currentState: GameState,
  input: InputState,
  frameDeltaSeconds: number,
): GameState {
  if (!Number.isFinite(frameDeltaSeconds) || frameDeltaSeconds < 0) {
    throw new RangeError("Frame delta must be a finite non-negative number.");
  }
  if (currentState.status === "ended") {
    return currentState;
  }

  const state = structuredClone(currentState);
  const { fixedStepSec, maxFrameSec } = state.config.step;
  if (
    !Number.isFinite(fixedStepSec) ||
    fixedStepSec <= 0 ||
    !Number.isFinite(maxFrameSec) ||
    maxFrameSec < 0
  ) {
    throw new RangeError("Simulation timestep configuration is invalid.");
  }

  const frameEvents: GameEvent[] = [];
  state.accumulatorSec += Math.min(frameDeltaSeconds, maxFrameSec);

  while (state.accumulatorSec >= fixedStepSec && state.status !== "ended") {
    const nextState = stepGame(state, input);
    frameEvents.push(...nextState.events);
    Object.assign(state, nextState);
    state.accumulatorSec -= fixedStepSec;
  }

  state.events = frameEvents;
  return state;
}
