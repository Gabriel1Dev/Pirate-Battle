import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CONFIG } from "../game/config";
import { createKeyboardInput, type KeyboardInput } from "../game/input/keyboard";
import { initializePixiRenderer, type GameRenderer } from "../game/render/pixiRenderer";
import { advanceGame } from "../game/sim/step";
import { createInitialGameState } from "../game/sim/world";
import { pauseGame, resumeGame } from "../game/sim/pause";
import {
  EMPTY_INPUT,
  type GameState,
  type HudSnapshot,
  type InputState,
} from "../game/sim/types";
import { useGameStore } from "../store/gameStore";

interface GameTestHook {
  getState(): GameState | null;
  setInput(input: InputState): void;
  advanceBy(seconds: number): void;
  reset(seed: number): void;
  useRealtimeClock(): void;
}

declare global {
  interface Window {
    __game?: GameTestHook;
  }
}

interface GameScreenProps {
  readonly seed: number;
  readonly onExit: () => void;
  readonly onRestart: () => void;
}

interface TouchControl {
  readonly action: keyof InputState;
  readonly label: string;
}

const TOUCH_CONTROLS: readonly TouchControl[] = [
  { action: "turnLeft", label: "Turn left" },
  { action: "forward", label: "Move forward" },
  { action: "turnRight", label: "Turn right" },
  { action: "fireLeft", label: "Fire left broadside" },
  { action: "fireFront", label: "Fire front" },
  { action: "fireRight", label: "Fire right broadside" },
];

function createHudSnapshot(state: GameState): HudSnapshot {
  return {
    score: state.score,
    timeLeftSec: Math.ceil(state.timeLeftSec),
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    status: state.status,
    ...(state.endReason ? { endReason: state.endReason } : {}),
  };
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function GameScreen({
  seed,
  onExit,
  onRestart,
}: GameScreenProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const inputStateRef = useRef<InputState>({ ...EMPTY_INPUT });
  const inputRef = useRef<KeyboardInput | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const hud = useGameStore((store) => store.hud);
  const setHud = useGameStore((store) => store.setHud);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    let manualClock = false;
    let hudElapsedSeconds = 0;
    const initialState = createInitialGameState(seed, DEFAULT_CONFIG);
    gameStateRef.current = initialState;
    setHud(createHudSnapshot(initialState));
    setLoadError(null);
    setLoaded(false);

    const handlePause = (): void => {
      const state = gameStateRef.current;
      if (!state) {
        return;
      }

      const pausedState = pauseGame(state);
      gameStateRef.current = pausedState;
      inputRef.current?.clear();
      setHud(createHudSnapshot(pausedState));
    };
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        handlePause();
      }
    };
    const testHook: GameTestHook = {
      getState: () => {
        const state = gameStateRef.current;
        return state ? structuredClone(state) : null;
      },
      setInput: (input) => {
        Object.assign(inputStateRef.current, input);
      },
      advanceBy: (seconds) => {
        if (!Number.isFinite(seconds) || seconds < 0) {
          throw new RangeError("Test clock delta must be non-negative.");
        }

        let state = gameStateRef.current;
        if (!state) {
          return;
        }
        manualClock = true;
        let remainingSeconds = seconds;
        while (remainingSeconds > 0 && state.status === "running") {
          const delta = Math.min(
            remainingSeconds,
            state.config.step.maxFrameSec,
          );
          state = advanceGame(state, inputStateRef.current, delta);
          remainingSeconds -= delta;
        }

        gameStateRef.current = state;
        rendererRef.current?.draw(state);
        setHud(createHudSnapshot(state));
      },
      reset: (nextSeed) => {
        const state = createInitialGameState(nextSeed, DEFAULT_CONFIG);
        manualClock = true;
        gameStateRef.current = state;
        Object.assign(inputStateRef.current, EMPTY_INPUT);
        inputRef.current?.clear();
        rendererRef.current?.draw(state);
        setHud(createHudSnapshot(state));
      },
      useRealtimeClock: () => {
        manualClock = false;
      },
    };
    if (import.meta.env.DEV) {
      window.__game = testHook;
    }

    window.addEventListener("blur", handlePause);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void initializePixiRenderer(host, initialState.config)
      .then((renderer) => {
        if (cancelled) {
          renderer.destroy();
          return;
        }

        rendererRef.current = renderer;
        setLoaded(true);
        const keyboard = createKeyboardInput(inputStateRef.current);
        inputRef.current = keyboard;
        renderer.draw(initialState);
        let hudDirty = true;

        renderer.application.ticker.add((ticker) => {
          const currentState = gameStateRef.current;
          if (!currentState) {
            return;
          }

          if (currentState.status === "running" && !manualClock) {
            const nextState = advanceGame(
              currentState,
              keyboard.state,
              ticker.deltaMS / 1000,
            );
            gameStateRef.current = nextState;
            hudDirty ||= nextState.status !== currentState.status;
          }

          const nextState = gameStateRef.current;
          if (!nextState) {
            return;
          }

          renderer.draw(nextState);
          hudElapsedSeconds += ticker.deltaMS / 1000;
          if (hudElapsedSeconds >= 0.1 || hudDirty) {
            setHud(createHudSnapshot(nextState));
            hudElapsedSeconds = 0;
            hudDirty = false;
          }
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "The game assets could not be loaded.",
          );
        }
      });

    return () => {
      cancelled = true;
      if (window.__game === testHook) {
        delete window.__game;
      }
      window.removeEventListener("blur", handlePause);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      inputRef.current?.destroy();
      inputRef.current = null;
      rendererRef.current?.destroy();
      rendererRef.current = null;
      gameStateRef.current = null;
      setHud({
        score: 0,
        timeLeftSec: DEFAULT_CONFIG.match.durationSec,
        hp: DEFAULT_CONFIG.player.maxHp,
        maxHp: DEFAULT_CONFIG.player.maxHp,
        status: "ended",
      });
    };
  }, [loadAttempt, seed, setHud]);

  const togglePause = useCallback((): void => {
    const state = gameStateRef.current;
    if (!state) {
      return;
    }

    const nextState =
      state.status === "paused" ? resumeGame(state) : pauseGame(state);
    gameStateRef.current = nextState;
    inputRef.current?.clear();
    setHud(createHudSnapshot(nextState));
  }, [setHud]);

  const setTouchAction = useCallback(
    (action: keyof InputState, pressed: boolean): void => {
      inputRef.current?.setAction(action, pressed);
    },
    [],
  );

  const isPaused = hud?.status === "paused";
  const isFinished = hud?.status === "ended";

  return (
    <main className="game-screen">
      <header className="game-toolbar">
        <div className="game-brand">
          <span className="game-kicker">Open waters</span>
          <h1>Pirate Battle</h1>
        </div>
        <div className="game-hud" aria-label="Current match status">
          <div className="hud-stat">
            <span>Score</span>
            <strong>{hud?.score ?? 0}</strong>
          </div>
          <div className="hud-stat">
            <span>Time</span>
            <strong>{formatTime(hud?.timeLeftSec ?? 0)}</strong>
          </div>
          <div
            className="hud-stat hud-health"
            aria-label={`Ship health ${hud?.hp ?? 0} of ${hud?.maxHp ?? 0}`}
          >
            <span>Hull</span>
            <strong>
              {hud?.hp ?? 0}/{hud?.maxHp ?? 0}
            </strong>
            <span className="hud-health-track">
              <span
                style={{
                  width: `${hud?.maxHp ? ((hud.hp / hud.maxHp) * 100).toFixed(1) : 0}%`,
                }}
              />
            </span>
          </div>
        </div>
        <div className="game-toolbar-actions">
          {!isFinished && (
            <button
              className="secondary-button"
              onClick={togglePause}
              type="button"
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
          )}
          <button className="text-button" onClick={onExit} type="button">
            Main menu
          </button>
        </div>
      </header>

      <section className="arena-frame" aria-label="Naval battle arena">
        <div className="arena-host" ref={hostRef} />
        {loadError && (
          <div className="arena-overlay" role="alert">
            <div className="overlay-card">
              <h2>Unable to load the battle</h2>
              <p>{loadError}</p>
              <button
                className="primary-button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                type="button"
              >
                Retry loading
              </button>
            </div>
          </div>
        )}
        {!loadError && !loaded && (
          <div className="arena-loading" aria-live="polite">
            Loading battle assets…
          </div>
        )}
        {(isPaused || isFinished) && (
          <div className="arena-overlay" role="status">
            <div className="overlay-card">
              <span className="game-kicker">
                {isFinished ? "Voyage complete" : "Battle paused"}
              </span>
              <h2>
                {isFinished
                  ? hud?.endReason === "death"
                    ? "Your ship has fallen"
                    : "Time is up"
                  : "Take a breath, Captain"}
              </h2>
              {isFinished && <p>Final score: {hud?.score ?? 0}</p>}
              {!isFinished && (
                <button
                  className="primary-button"
                  onClick={togglePause}
                  type="button"
                >
                  Resume battle
                </button>
              )}
              {isFinished && (
                <button
                  className="primary-button"
                  onClick={onRestart}
                  type="button"
                >
                  Play again
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <footer className="game-footer">
        <p className="keyboard-hint">
          Move <kbd>W</kbd>/<kbd>↑</kbd>
          <span>Turn <kbd>A</kbd>/<kbd>D</kbd></span>
          <span>Front <kbd>Space</kbd></span>
          <span>Broadsides <kbd>Q</kbd>/<kbd>E</kbd></span>
        </p>
        <div className="touch-controls" aria-label="Touch controls">
          {TOUCH_CONTROLS.map(({ action, label }) => (
            <button
              aria-label={label}
              className={`touch-control touch-${action}`}
              key={action}
              onPointerCancel={() => setTouchAction(action, false)}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                setTouchAction(action, true);
              }}
              onPointerLeave={() => setTouchAction(action, false)}
              onPointerUp={() => setTouchAction(action, false)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </footer>
    </main>
  );
}
