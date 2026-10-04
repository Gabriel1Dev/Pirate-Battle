import { useCallback, useEffect, useRef, useState } from "react";
import type { GameConfig } from "../game/config";
import {
  createKeyboardInput,
  type KeyboardInput,
} from "../game/input/keyboard";
import {
  initializePixiRenderer,
  type GameRenderer,
} from "../game/render/pixiRenderer";
import { advanceGame } from "../game/sim/step";
import { createInitialGameState } from "../game/sim/world";
import { pauseGame, resumeGame } from "../game/sim/pause";
import { GameAudio } from "../game/audio/gameAudio";
import {
  EMPTY_INPUT,
  type GameState,
  type HudSnapshot,
  type InputState,
} from "../game/sim/types";
import { useGameStore } from "../store/gameStore";
import type { MatchOptions } from "../game/config";
import type { MatchResultDraft } from "../store/matchStorage";
import { OptionsScreen } from "./OptionsScreen";

interface GameTestHook {
  getState(): GameState | null;
  setInput(input: Partial<InputState>): void;
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
  readonly matchId: string;
  readonly config: GameConfig;
  readonly options: MatchOptions;
  readonly onMatchFinished: (result: MatchResultDraft) => void;
  readonly onExit: () => void;
  readonly onRestart: () => void;
  readonly onSaveOptions: (options: MatchOptions) => void;
}

interface TouchControl {
  readonly action: keyof InputState;
  readonly label: string;
  readonly icon: string;
}

const TOUCH_CONTROLS: readonly TouchControl[] = [
  {
    action: "turnLeft",
    label: "Turn left",
    icon: "/assets/png/default/ui/controls/icon_turn_left.png",
  },
  {
    action: "forward",
    label: "Move forward",
    icon: "/assets/png/default/ui/controls/icon_forward.png",
  },
  {
    action: "turnRight",
    label: "Turn right",
    icon: "/assets/png/default/ui/controls/icon_turn_right.png",
  },
  {
    action: "fireLeft",
    label: "Fire left broadside",
    icon: "/assets/png/default/ui/controls/icon_fire_left.png",
  },
  {
    action: "fireFront",
    label: "Fire front",
    icon: "/assets/png/default/ui/controls/icon_fire_front.png",
  },
  {
    action: "fireRight",
    label: "Fire right broadside",
    icon: "/assets/png/default/ui/controls/icon_fire_right.png",
  },
];

const HEALTH_FILL_PATHS = {
  green: "/assets/png/default/ui/hud/health_fill_green.png",
  amber: "/assets/png/default/ui/hud/health_fill_amber.png",
  red: "/assets/png/default/ui/hud/health_fill_red.png",
} as const;

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
  matchId,
  config,
  options,
  onMatchFinished,
  onExit,
  onRestart,
  onSaveOptions,
}: GameScreenProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const inputStateRef = useRef<InputState>({ ...EMPTY_INPUT });
  const inputRef = useRef<KeyboardInput | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const hud = useGameStore((store) => store.hud);
  const setHud = useGameStore((store) => store.setHud);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [assetProgress, setAssetProgress] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionsSaveError, setOptionsSaveError] = useState<string | null>(null);
  const [matchSaveError, setMatchSaveError] = useState<string | null>(null);
  const [matchSaved, setMatchSaved] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    let manualClock = false;
    let hudElapsedSeconds = 0;
    let matchWasPersisted = false;
    const audio = new GameAudio();
    audioRef.current = audio;
    const initialState = createInitialGameState(seed, config);
    gameStateRef.current = initialState;
    setHud(createHudSnapshot(initialState));
    setLoadError(null);
    setLoaded(false);
    setAssetProgress(0);
    setMatchSaveError(null);
    setMatchSaved(false);

    const persistFinishedMatch = (state: GameState): void => {
      if (
        matchWasPersisted ||
        state.status !== "ended" ||
        state.endReason === undefined
      ) {
        return;
      }

      matchWasPersisted = true;
      try {
        onMatchFinished({
          matchId,
          completedAt: new Date().toISOString(),
          score: state.score,
          durationSec: state.elapsedSec,
          endReason: state.endReason,
          config: state.config,
        });
        setMatchSaved(true);
        setMatchSaveError(null);
      } catch (error: unknown) {
        setMatchSaveError(
          error instanceof Error
            ? `The result could not be saved on this device: ${error.message}`
            : "The result could not be saved on this device.",
        );
      }
    };

    const handlePause = (): void => {
      const state = gameStateRef.current;
      if (!state) {
        return;
      }

      const pausedState = pauseGame(state);
      if (pausedState !== state) {
        audio.pause();
      }
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
        Object.assign(inputStateRef.current, EMPTY_INPUT, input);
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
          const nextState = advanceGame(state, inputStateRef.current, delta);
          audio.update(state, nextState);
          state = nextState;
          remainingSeconds -= delta;
        }

        gameStateRef.current = state;
        persistFinishedMatch(state);
        rendererRef.current?.draw(state);
        setHud(createHudSnapshot(state));
      },
      reset: (nextSeed) => {
        const state = createInitialGameState(nextSeed, config);
        manualClock = true;
        gameStateRef.current = state;
        Object.assign(inputStateRef.current, EMPTY_INPUT);
        inputRef.current?.clear();
        audio.reset();
        rendererRef.current?.draw(state);
        setHud(createHudSnapshot(state));
      },
      useRealtimeClock: () => {
        manualClock = false;
      },
    };
    if (import.meta.env.DEV || import.meta.env.MODE === "performance") {
      window.__game = testHook;
    }

    window.addEventListener("blur", handlePause);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void initializePixiRenderer(host, initialState.config, (progress) => {
      if (!cancelled) {
        setAssetProgress(progress);
      }
    })
      .then((renderer) => {
        if (cancelled) {
          renderer.destroy();
          return;
        }

        rendererRef.current = renderer;
        audio.start();
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
            audio.update(currentState, nextState);
            gameStateRef.current = nextState;
            persistFinishedMatch(nextState);
            hudDirty ||= nextState.status !== currentState.status;
          }

          const nextState = gameStateRef.current;
          if (!nextState) {
            return;
          }

          renderer.draw(nextState, ticker.deltaMS / 1000);
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
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      inputRef.current?.destroy();
      inputRef.current = null;
      audio.dispose();
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      rendererRef.current?.destroy();
      rendererRef.current = null;
      gameStateRef.current = null;
      setHud({
        score: 0,
        timeLeftSec: config.match.durationSec,
        hp: config.player.maxHp,
        maxHp: config.player.maxHp,
        status: "ended",
      });
    };
  }, [config, loadAttempt, matchId, onMatchFinished, seed, setHud]);

  const togglePause = useCallback((): void => {
    const state = gameStateRef.current;
    if (!state) {
      return;
    }

    const nextState =
      state.status === "paused" ? resumeGame(state) : pauseGame(state);
    if (nextState.status === "paused") {
      audioRef.current?.pause();
    } else if (nextState.status === "running") {
      audioRef.current?.resume();
    }
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
  const elapsedSeconds = Math.max(
    0,
    config.match.durationSec - (hud?.timeLeftSec ?? config.match.durationSec),
  );
  const healthRatio = hud?.maxHp
    ? Math.max(0, Math.min(1, hud.hp / hud.maxHp))
    : 0;
  const [firstDamageStage, secondDamageStage] =
    config.visual.damageStages;
  const healthFillPath =
    healthRatio <= secondDamageStage
      ? HEALTH_FILL_PATHS.red
      : healthRatio <= firstDamageStage
        ? HEALTH_FILL_PATHS.amber
        : HEALTH_FILL_PATHS.green;
  const saveOptionsFromPause = (nextOptions: MatchOptions): void => {
    try {
      onSaveOptions(nextOptions);
      setOptionsSaveError(null);
      setOptionsOpen(false);
    } catch (error: unknown) {
      setOptionsSaveError(
        error instanceof Error
          ? `Options could not be saved: ${error.message}`
          : "Options could not be saved in this browser.",
      );
    }
  };

  return (
    <main className="game-screen">
      <header className="game-toolbar">
        <div className="game-brand">
          <span className="game-kicker">Good Luck</span>
          <h1>Pirate Battle</h1>
        </div>
        <div className="game-hud" aria-label="Current match status">
          <div className="hud-stat hud-score">
            <span className="hud-stat-icon" aria-hidden="true">
              <img src="/assets/png/default/ui/hud/icon_score.png" alt="" />
            </span>
            <span className="sr-only">Score</span>
            <strong>{hud?.score ?? 0}</strong>
          </div>
          <div className="hud-stat hud-time">
            <span className="hud-stat-icon" aria-hidden="true">
              <img src="/assets/png/default/ui/hud/icon_time.png" alt="" />
            </span>
            <span className="sr-only">Time</span>
            <strong>{formatTime(hud?.timeLeftSec ?? 0)}</strong>
          </div>
          <div
            className="hud-stat hud-health"
            aria-label={`Ship health ${hud?.hp ?? 0} of ${hud?.maxHp ?? 0}`}
          >
            <span className="hud-health-icon" aria-hidden="true">
              <img src="/assets/png/default/ui/hud/icon_heart.png" alt="" />
            </span>
            <span className="hud-health-meter" aria-hidden="true">
              <img
                className="hud-health-frame"
                src="/assets/png/default/ui/hud/health_frame.png"
                alt=""
              />
              <img
                className="hud-health-fill"
                src={healthFillPath}
                style={{
                  clipPath: `inset(0 ${(1 - healthRatio) * 100}% 0 0)`,
                }}
                alt=""
              />
              <strong className="hud-health-value">
                {hud?.hp ?? 0}/{hud?.maxHp ?? 0}
              </strong>
            </span>
          </div>
        </div>
        <div className="game-toolbar-actions">
          {!isFinished && (
            <button
              aria-label={isPaused ? "Resume battle" : "Pause battle"}
              className="asset-icon-button"
              onClick={togglePause}
              title={isPaused ? "Resume battle" : "Pause battle"}
              type="button"
            >
              <img
                src={`/assets/png/default/ui/controls/icon_${isPaused ? "play" : "pause"}.png`}
                alt=""
              />
            </button>
          )}
          <button
            aria-label="Main menu"
            className="asset-icon-button"
            onClick={onExit}
            title="Main menu"
            type="button"
          >
            <img src="/assets/png/default/ui/controls/icon_home.png" alt="" />
          </button>
        </div>
      </header>

      <section className="arena-frame" aria-label="Naval battle arena">
        <div className="arena-host" ref={hostRef} />
        {loadError && (
          <div className="arena-overlay" role="alert">
            <div className="overlay-card">
              <span className="game-kicker">Crew report</span>
              <h2>Unable to load the battle</h2>
              <p>{loadError}</p>
              <button
                className="primary-button menu-button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                type="button"
              >
                RETRY LOADING
              </button>
            </div>
          </div>
        )}
        {!loadError && !loaded && (
          <div className="arena-loading" aria-live="polite">
            <div className="arena-loading-card">
              <span>Loading battle assets… {Math.round(assetProgress * 100)}%</span>
              <progress
                aria-label="Battle asset loading progress"
                max={1}
                value={assetProgress}
              />
            </div>
          </div>
        )}
        {(isPaused || isFinished) && !optionsOpen && (
          <div
            aria-labelledby="match-overlay-title"
            aria-modal="true"
            className="arena-overlay"
            role="dialog"
          >
            <div className="overlay-card">
              <span className="game-kicker">
                {isFinished ? "Battle complete" : "Ready when you are"}
              </span>
              <h2 id="match-overlay-title">
                {isFinished
                  ? "VOYAGE COMPLETE"
                  : "PAUSED"}
              </h2>
              {isFinished ? (
                <>
                  <strong className="result-score">{hud?.score ?? 0}</strong>
                  <p className="result-summary">
                    {hud?.score ?? 0} POINTS · {formatTime(elapsedSeconds)} ·{" "}
                    {hud?.endReason === "death" ? "DEFEATED" : "TIME UP"}
                  </p>
                  {matchSaveError ? (
                    <p className="options-error" role="alert">
                      {matchSaveError}
                    </p>
                  ) : (
                    matchSaved && (
                      <p className="pending-match-status" role="status">
                        Saved on this device.
                      </p>
                    )
                  )}
                  <div className="overlay-actions">
                    <button
                      className="primary-button menu-button"
                      onClick={onRestart}
                      type="button"
                    >
                      PLAY AGAIN
                    </button>
                    <button
                      className="primary-button menu-button"
                      onClick={onExit}
                      type="button"
                    >
                      MAIN MENU
                    </button>
                  </div>
                </>
              ) : (
                <div className="overlay-actions">
                  <button
                    className="primary-button menu-button"
                    onClick={togglePause}
                    type="button"
                  >
                    RESUME
                  </button>
                  <button
                    className="primary-button menu-button"
                    onClick={() => {
                      setOptionsSaveError(null);
                      setOptionsOpen(true);
                    }}
                    type="button"
                  >
                    OPTIONS
                  </button>
                  <button
                    className="primary-button menu-button"
                    onClick={onExit}
                    type="button"
                  >
                    MAIN MENU
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <footer className="game-footer">
        <div className="menu-card game-controls-panel">
          <p className="keyboard-hint">
            <span>
              Move <kbd>W</kbd>/<kbd>↑</kbd>
            </span>
            <span>
              Turn <kbd>A</kbd>/<kbd>D</kbd>
            </span>
            <span>
              Front <kbd>Space</kbd>
            </span>
            <span>
              Broadsides <kbd>Q</kbd>/<kbd>E</kbd>
            </span>
          </p>
          <div className="touch-controls" aria-label="Touch controls">
            {[TOUCH_CONTROLS.slice(0, 3), TOUCH_CONTROLS.slice(3)].map(
              (group, index) => (
                <div
                  className={`touch-control-group touch-control-group-${index + 1}`}
                  key={index}
                >
                  {group.map(({ action, icon, label }) => (
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
                      <img src={icon} alt="" />
                      <span className="sr-only">{label}</span>
                    </button>
                  ))}
                </div>
              ),
            )}
          </div>
        </div>
      </footer>
      {optionsOpen && (
        <OptionsScreen
          initialOptions={options}
          onCancel={() => setOptionsOpen(false)}
          onSave={saveOptionsFromPause}
          persistenceError={optionsSaveError}
          presentation="dialog"
        />
      )}
    </main>
  );
}
