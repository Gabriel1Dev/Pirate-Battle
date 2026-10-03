import { useState } from "react";
import {
  createMatchConfig,
  DEFAULT_OPTIONS,
  type GameConfig,
  type MatchOptions,
} from "./game/config";
import { OptionsScreen } from "./ui/OptionsScreen";
import "./App.css";
import { GameScreen } from "./ui/GameScreen";
import {
  readStoredOptions,
  saveStoredOptions,
  type StoredOptionsResult,
} from "./store/optionsStorage";

type AppScreen = "menu" | "options" | "game";

export default function App(): React.JSX.Element {
  const [screen, setScreen] = useState<AppScreen>("menu");
  const [gameSeed, setGameSeed] = useState(1);
  const [storedOptions, setStoredOptions] = useState<StoredOptionsResult>(
    () => readStoredOptions(),
  );
  const [activeConfig, setActiveConfig] = useState<GameConfig>(() =>
    createMatchConfig(DEFAULT_OPTIONS),
  );

  const startGame = (): void => {
    setActiveConfig(createMatchConfig(storedOptions.options));
    setGameSeed((seed) => seed + 1);
    setScreen("game");
  };

  const saveOptions = (options: MatchOptions): void => {
    try {
      saveStoredOptions(options);
      setStoredOptions({ options: { ...options }, error: null });
      setScreen("menu");
    } catch (error: unknown) {
      setStoredOptions((current) => ({
        ...current,
        error:
          error instanceof Error
            ? `Options could not be saved: ${error.message}`
            : "Options could not be saved in this browser.",
      }));
    }
  };

  const saveOptionsFromGame = (options: MatchOptions): void => {
    saveStoredOptions(options);
    setStoredOptions({ options: { ...options }, error: null });
  };

  if (screen === "game") {
    return (
      <GameScreen
        key={gameSeed}
        config={activeConfig}
        options={storedOptions.options}
        onSaveOptions={saveOptionsFromGame}
        onExit={() => setScreen("menu")}
        onRestart={() => setGameSeed((seed) => seed + 1)}
        seed={gameSeed}
      />
    );
  }

  if (screen === "options") {
    return (
      <OptionsScreen
        initialOptions={storedOptions.options}
        onCancel={() => setScreen("menu")}
        onSave={saveOptions}
        persistenceError={storedOptions.error}
      />
    );
  }

  return (
    <main className="menu-screen">
      <section
        className="menu-card home-card"
        aria-labelledby="main-menu-title"
      >
        <img
          className="menu-title-image"
          src="/assets/png/default/ui/menu/title_pirate_battle.png"
          alt=""
        />
        <h1 className="sr-only" id="main-menu-title">
          Pirate Battle
        </h1>
        <p className="menu-tagline">SET SAIL. TAKE COMMAND.</p>
        {storedOptions.error && (
          <p className="options-error" role="alert">
            {storedOptions.error}
          </p>
        )}
        <div className="menu-action-stack">
          <button
            className="primary-button menu-button"
            onClick={startGame}
            type="button"
          >
            PLAY
          </button>
          <button
            className="secondary-button menu-button"
            onClick={() => setScreen("options")}
            type="button"
          >
            OPTIONS
          </button>
        </div>
        <img
          className="menu-ship-decoration"
          src="/assets/png/default/ships/ship_1.png"
          alt=""
        />
        <p className="menu-description">
          Navigate the islands. Survive the battle.
        </p>
        <div className="controls" aria-label="Keyboard controls">
          <div className="control">
            <span className="key">W</span>
            <span className="key">↑</span>
            <span>Move</span>
          </div>

          <div className="control">
            <span className="key">A</span>
            <span className="key">D</span>
            <span>Turn</span>
          </div>

          <div className="control">
            <span className="key wide">SPACE</span>
            <span>Fire</span>
          </div>

          <div className="control">
            <span className="key">Q</span>
            <span className="key">E</span>
            <span>Broadside</span>
          </div>
        </div>
      </section>
    </main>
  );
}
