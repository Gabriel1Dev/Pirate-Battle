import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  getPendingMatches,
  markMatchConfirmed,
  createMatchId,
  readStoredMatches,
  savePendingMatch,
  type MatchResultDraft,
  type StoredMatchRecord,
  type StoredMatchesResult,
} from "./store/matchStorage";
import { useMatchHistory, useRanking, useSubmitMatch } from "./api/queries";
import type { MatchRecord } from "./api/contracts";
import {
  getNetworkScenario,
  NETWORK_SCENARIOS,
  resetNetworkScenario,
  setNetworkScenario,
  type NetworkScenario,
} from "./mocks/scenarios";

type AppScreen = "menu" | "options" | "game";
type MenuTab = "home" | "ranking" | "history";

function formatMatchDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toMatchRecord(match: StoredMatchRecord): MatchRecord {
  return {
    matchId: match.matchId,
    playerId: match.playerId,
    completedAt: match.completedAt,
    score: match.score,
    durationSec: match.durationSec,
    endReason: match.endReason,
    config: match.config,
  };
}

export default function App(): React.JSX.Element {
  const [screen, setScreen] = useState<AppScreen>("menu");
  const [menuTab, setMenuTab] = useState<MenuTab>("home");
  const [rankingPage, setRankingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [networkScenario, setCurrentNetworkScenario] = useState<NetworkScenario>(
    () => getNetworkScenario(),
  );
  const [gameSeed, setGameSeed] = useState(1);
  const [matchId, setMatchId] = useState(() => createMatchId());
  const [storedOptions, setStoredOptions] = useState<StoredOptionsResult>(
    () => readStoredOptions(),
  );
  const [storedMatches, setStoredMatches] = useState<StoredMatchesResult>(
    () => readStoredMatches(),
  );
  const [activeConfig, setActiveConfig] = useState<GameConfig>(() =>
    createMatchConfig(DEFAULT_OPTIONS),
  );
  const queryClient = useQueryClient();
  const submitMatchMutation = useSubmitMatch();
  const { mutateAsync: submitMatchAsync } = submitMatchMutation;
  const attemptedMatchIds = useRef(new Set<string>());
  const pendingMatches = useMemo(
    () => getPendingMatches(storedMatches.matches),
    [storedMatches.matches],
  );
  const rankingConfig = useMemo(
    () => createMatchConfig(storedOptions.options),
    [storedOptions.options],
  );
  const rankingQuery = useRanking(
    rankingPage,
    rankingConfig,
    screen === "menu" && menuTab === "ranking",
    networkScenario,
  );
  const historyQuery = useMatchHistory(
    storedMatches.matches.playerId,
    historyPage,
    screen === "menu" && menuTab === "history",
    networkScenario,
  );

  const submitPendingMatch = useCallback(
    async (match: MatchRecord): Promise<void> => {
      try {
        await submitMatchAsync(match);
        const matches = markMatchConfirmed(match.matchId);
        setStoredMatches({ matches, error: null });
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "The match could not be uploaded. It remains saved on this device.";
        setStoredMatches((current) => ({ ...current, error: message }));
      }
    },
    [submitMatchAsync],
  );

  useEffect(() => {
    for (const match of pendingMatches) {
      if (attemptedMatchIds.current.has(match.matchId)) {
        continue;
      }
      attemptedMatchIds.current.add(match.matchId);
      void submitPendingMatch(toMatchRecord(match));
    }
  }, [pendingMatches, submitPendingMatch]);

  const startGame = (): void => {
    setActiveConfig(createMatchConfig(storedOptions.options));
    setMatchId(createMatchId());
    setGameSeed((seed) => seed + 1);
    setMenuTab("home");
    setScreen("game");
  };

  const saveFinishedMatch = useCallback((result: MatchResultDraft): void => {
    const matches = savePendingMatch(result);
    setStoredMatches({ matches, error: null });
  }, []);

  const retryPendingMatch = (match: MatchRecord): void => {
    attemptedMatchIds.current.delete(match.matchId);
    void submitPendingMatch(match);
  };

  const selectNetworkScenario = (scenario: NetworkScenario): void => {
    setNetworkScenario(scenario);
    setCurrentNetworkScenario(scenario);
    void queryClient.invalidateQueries();
  };

  const resetNetwork = (): void => {
    resetNetworkScenario();
    setCurrentNetworkScenario("success");
    void queryClient.invalidateQueries();
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
        matchId={matchId}
        onMatchFinished={saveFinishedMatch}
        onSaveOptions={saveOptionsFromGame}
        onExit={() => setScreen("menu")}
        onRestart={() => {
          setMatchId(createMatchId());
          setGameSeed((seed) => seed + 1);
        }}
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
        {storedMatches.error && (
          <p className="options-error" role="alert">
            {storedMatches.error}
          </p>
        )}
        {storedMatches.matches.matches.length > 0 && (
          <p className="pending-match-status" role="status">
            {pendingMatches.length} match
            {pendingMatches.length === 1 ? "" : "es"} awaiting upload ·{" "}
            {storedMatches.matches.matches.length - pendingMatches.length} saved
            remotely.
          </p>
        )}
        {pendingMatches.length > 0 && (
          <div className="pending-match-list" aria-label="Pending match uploads">
            {pendingMatches.map((match) => (
              <button
                className="text-action-button"
                key={match.matchId}
                onClick={() => retryPendingMatch(toMatchRecord(match))}
                type="button"
              >
                Retry upload {match.matchId.slice(0, 8)}
              </button>
            ))}
          </div>
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
        <section className="network-scenario" aria-label="Network scenario controls">
          <label htmlFor="network-scenario">Network demo</label>
          <select
            id="network-scenario"
            onChange={(event) => {
              const selectedScenario = NETWORK_SCENARIOS.find(
                (scenario) => scenario === event.currentTarget.value,
              );
              if (selectedScenario) {
                selectNetworkScenario(selectedScenario);
              }
            }}
            value={networkScenario}
          >
            {NETWORK_SCENARIOS.map((scenario) => (
              <option key={scenario} value={scenario}>
                {scenario}
              </option>
            ))}
          </select>
          <button
            className="text-action-button"
            onClick={resetNetwork}
            type="button"
          >
            Reset mock data
          </button>
        </section>
        <nav className="menu-data-tabs" aria-label="Match data">
          <button
            aria-pressed={menuTab === "ranking"}
            onClick={() => {
              setMenuTab("ranking");
              setRankingPage(1);
            }}
            type="button"
          >
            Ranking
          </button>
          <button
            aria-pressed={menuTab === "history"}
            onClick={() => {
              setMenuTab("history");
              setHistoryPage(1);
            }}
            type="button"
          >
            Match History
          </button>
        </nav>
        {menuTab !== "home" && (
          <section
            className="menu-data-panel"
            aria-label={menuTab === "ranking" ? "Ranking" : "Match history"}
            aria-live="polite"
            aria-busy={
              menuTab === "ranking"
                ? rankingQuery.isFetching
                : historyQuery.isFetching
            }
          >
            <h2>{menuTab === "ranking" ? "Ranking" : "Match History"}</h2>
            {menuTab === "ranking" &&
              rankingQuery.isFetching &&
              rankingQuery.data && <p role="status">Updating ranking…</p>}
            {menuTab === "ranking" &&
              rankingQuery.isError &&
              rankingQuery.data && (
                <p role="alert">
                  Ranking refresh failed; showing the last available results.
                  <button
                    className="text-action-button"
                    onClick={() => void rankingQuery.refetch()}
                    type="button"
                  >
                    Retry
                  </button>
                </p>
              )}
            {menuTab === "history" &&
              historyQuery.isFetching &&
              historyQuery.data && <p role="status">Updating match history…</p>}
            {menuTab === "history" &&
              historyQuery.isError &&
              historyQuery.data && (
                <p role="alert">
                  History refresh failed; showing the last available results.
                  <button
                    className="text-action-button"
                    onClick={() => void historyQuery.refetch()}
                    type="button"
                  >
                    Retry
                  </button>
                </p>
              )}
            {menuTab === "ranking" && (
              rankingQuery.isPending ? (
                <p role="status">Loading ranking…</p>
              ) : rankingQuery.isError && !rankingQuery.data ? (
                <div role="alert">
                  <p>Ranking could not be loaded.</p>
                  <button
                    className="text-action-button"
                    onClick={() => void rankingQuery.refetch()}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              ) : Array.isArray(rankingQuery.data?.items) &&
                rankingQuery.data.items.length > 0 ? (
                <>
                  <ol className="data-list">
                    {rankingQuery.data.items.map((entry, index) => (
                      <li key={entry.matchId}>
                        <span>#{(rankingPage - 1) * 5 + index + 1} {entry.playerName}</span>
                        <strong>{entry.score}</strong>
                        <small>{formatMatchDate(entry.completedAt)}</small>
                      </li>
                    ))}
                  </ol>
                  <p className="pagination-controls">
                    <button
                      disabled={rankingPage <= 1}
                      onClick={() => setRankingPage((page) => page - 1)}
                      type="button"
                    >
                      Previous
                    </button>
                    <span>
                      Page {rankingQuery.data.page} of{" "}
                      {Math.max(1, rankingQuery.data.totalPages)}
                    </span>
                    <button
                      disabled={rankingPage >= rankingQuery.data.totalPages}
                      onClick={() => setRankingPage((page) => page + 1)}
                      type="button"
                    >
                      Next
                    </button>
                  </p>
                </>
              ) : (
                <p>No ranking entries yet.</p>
              )
            )}
            {menuTab === "history" && (
              !storedMatches.matches.playerId ? (
                <p>Complete a match to start your history.</p>
              ) : historyQuery.isPending ? (
                <p role="status">Loading match history…</p>
              ) : historyQuery.isError && !historyQuery.data ? (
                <div role="alert">
                  <p>Match history could not be loaded.</p>
                  <button
                    className="text-action-button"
                    onClick={() => void historyQuery.refetch()}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              ) : Array.isArray(historyQuery.data?.items) &&
                historyQuery.data.items.length > 0 ? (
                <>
                  <ol className="data-list">
                    {historyQuery.data.items.map((match) => (
                      <li key={match.matchId}>
                        <span>
                          {match.score} points · {Math.floor(match.durationSec)}s
                        </span>
                        <strong>
                          {match.endReason === "time" ? "Time" : "Defeat"}
                        </strong>
                        <small>{formatMatchDate(match.completedAt)}</small>
                      </li>
                    ))}
                  </ol>
                  <p className="pagination-controls">
                    <button
                      disabled={historyPage <= 1}
                      onClick={() => setHistoryPage((page) => page - 1)}
                      type="button"
                    >
                      Previous
                    </button>
                    <span>
                      Page {historyQuery.data.page} of{" "}
                      {Math.max(1, historyQuery.data.totalPages)}
                    </span>
                    <button
                      disabled={historyPage >= historyQuery.data.totalPages}
                      onClick={() => setHistoryPage((page) => page + 1)}
                      type="button"
                    >
                      Next
                    </button>
                  </p>
                </>
              ) : (
                <p>No completed matches in your history.</p>
              )
            )}
          </section>
        )}
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
