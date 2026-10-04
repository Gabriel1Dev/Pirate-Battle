import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createMatchConfig,
  DEFAULT_OPTIONS,
  type GameConfig,
  type MatchOptions,
} from "./game/config";
import { playUiSound } from "./game/audio/gameAudio";
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
import { getNetworkScenario } from "./mocks/scenarios";

type AppScreen = "menu" | "options" | "game";
type MenuTab = "home" | "ranking" | "history";

function formatMatchDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainder
    .toString()
    .padStart(2, "0")}`;
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
  const networkScenario = getNetworkScenario();
  const [gameSeed, setGameSeed] = useState(1);
  const [matchId, setMatchId] = useState(() => createMatchId());
  const [storedOptions, setStoredOptions] = useState<StoredOptionsResult>(() =>
    readStoredOptions(),
  );
  const [storedMatches, setStoredMatches] = useState<StoredMatchesResult>(() =>
    readStoredMatches(),
  );
  const [activeConfig, setActiveConfig] = useState<GameConfig>(() =>
    createMatchConfig(DEFAULT_OPTIONS),
  );
  const submitMatchMutation = useSubmitMatch();
  const { mutateAsync: submitMatchAsync } = submitMatchMutation;
  const attemptedMatchIds = useRef(new Set<string>());
  const retryTimers = useRef(
    new Map<string, ReturnType<typeof window.setTimeout>>(),
  );
  const retryAttempts = useRef(new Map<string, number>());
  useEffect(() => {
    let audioUnlocked = false;
    const handleClick = (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) {
        return;
      }
      audioUnlocked = true;

      const button = event.target.closest("button");
      const label = button?.getAttribute("aria-label")?.toLowerCase() ?? "";
      if (
        !button ||
        button.disabled ||
        label === "pause battle" ||
        label === "resume battle" ||
        button.classList.contains("touch-control")
      ) {
        return;
      }

      const text = button.textContent?.trim().toLowerCase() ?? "";
      if (label.includes("close") || text === "close") {
        playUiSound("ui_close");
      } else if (
        label.includes("main menu") ||
        text === "main menu" ||
        text === "back" ||
        text === "cancel"
      ) {
        playUiSound("ui_back");
      } else if (
        text === "options" ||
        text === "ranking" ||
        text === "match history"
      ) {
        playUiSound("ui_open");
      } else {
        playUiSound("ui_click");
      }
    };
    const handlePointerOver = (event: PointerEvent): void => {
      if (!audioUnlocked || !(event.target instanceof Element)) {
        return;
      }

      const button = event.target.closest("button");
      if (
        !button ||
        button.disabled ||
        button.classList.contains("touch-control") ||
        (event.relatedTarget instanceof Node &&
          button.contains(event.relatedTarget))
      ) {
        return;
      }

      playUiSound("ui_hover");
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("pointerover", handlePointerOver);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("pointerover", handlePointerOver);
    };
  }, []);

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
      if (attemptedMatchIds.current.has(match.matchId)) {
        return;
      }

      attemptedMatchIds.current.add(match.matchId);
      try {
        await submitMatchAsync(match);
        const matches = markMatchConfirmed(match.matchId);
        const retryTimer = retryTimers.current.get(match.matchId);
        if (retryTimer !== undefined) {
          window.clearTimeout(retryTimer);
          retryTimers.current.delete(match.matchId);
        }
        retryAttempts.current.delete(match.matchId);
        setStoredMatches({ matches, error: null });
      } catch (error: unknown) {
        const cause =
          error instanceof Error
            ? error.message
            : "The match could not be uploaded.";
        setStoredMatches((current) => ({
          ...current,
          error: `${cause} The result is saved on this device and will be retried automatically.`,
        }));

        if (!retryTimers.current.has(match.matchId)) {
          const attempts = (retryAttempts.current.get(match.matchId) ?? 0) + 1;
          retryAttempts.current.set(match.matchId, attempts);
          const delayMs = Math.min(1000 * 2 ** (attempts - 1), 30_000);
          const retryTimer = window.setTimeout(() => {
            retryTimers.current.delete(match.matchId);
            void submitPendingMatch(match);
          }, delayMs);
          retryTimers.current.set(match.matchId, retryTimer);
        }
      } finally {
        attemptedMatchIds.current.delete(match.matchId);
      }
    },
    [submitMatchAsync],
  );

  useEffect(() => {
    for (const match of pendingMatches) {
      if (attemptedMatchIds.current.has(match.matchId)) {
        continue;
      }
      void submitPendingMatch(toMatchRecord(match));
    }
  }, [pendingMatches, submitPendingMatch]);

  useEffect(() => {
    const retryPendingMatches = (): void => {
      for (const match of pendingMatches) {
        const retryTimer = retryTimers.current.get(match.matchId);
        if (retryTimer !== undefined) {
          window.clearTimeout(retryTimer);
          retryTimers.current.delete(match.matchId);
        }
        retryAttempts.current.delete(match.matchId);
        void submitPendingMatch(toMatchRecord(match));
      }
    };

    window.addEventListener("online", retryPendingMatches);
    window.addEventListener("focus", retryPendingMatches);
    return () => {
      window.removeEventListener("online", retryPendingMatches);
      window.removeEventListener("focus", retryPendingMatches);
    };
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
    const retryTimer = retryTimers.current.get(match.matchId);
    if (retryTimer !== undefined) {
      window.clearTimeout(retryTimer);
      retryTimers.current.delete(match.matchId);
    }
    retryAttempts.current.delete(match.matchId);
    void submitPendingMatch(match);
  };

  const rankingContent = rankingQuery.isPending ? (
    <p className="data-screen-message" role="status">
      Loading ranking…
    </p>
  ) : rankingQuery.isError && !rankingQuery.data ? (
    <div className="data-screen-message" role="alert">
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
      <ol className="data-screen-rows ranking-rows">
        {rankingQuery.data.items.map((entry, index) => (
          <li key={entry.matchId}>
            <span className="data-rank">
              {((rankingPage - 1) * 5 + index + 1).toString().padStart(2, "0")}
            </span>
            <strong className="data-captain">{entry.playerName}</strong>
            <strong className="data-points">{entry.score}</strong>
            <time className="data-played" dateTime={entry.completedAt}>
              {formatMatchDate(entry.completedAt)}
            </time>
          </li>
        ))}
      </ol>
      <nav className="data-pagination" aria-label="Ranking pages">
        <button
          aria-label="Previous"
          className="data-page-button"
          disabled={rankingPage <= 1}
          onClick={() => setRankingPage((page) => page - 1)}
          type="button"
        >
          <img
            src="/assets/png/default/ui/controls/icon_turn_left.png"
            alt=""
          />
        </button>
        <span>
          Page {rankingQuery.data.page} of{" "}
          {Math.max(1, rankingQuery.data.totalPages)}
        </span>
        <button
          aria-label="Next"
          className="data-page-button"
          disabled={rankingPage >= rankingQuery.data.totalPages}
          onClick={() => setRankingPage((page) => page + 1)}
          type="button"
        >
          <img
            src="/assets/png/default/ui/controls/icon_turn_right.png"
            alt=""
          />
        </button>
      </nav>
    </>
  ) : (
    <p className="data-screen-message">No ranking entries yet.</p>
  );

  const historyContent = !storedMatches.matches.playerId ? (
    <p className="data-screen-message">
      Complete a match to start your history.
    </p>
  ) : historyQuery.isPending ? (
    <p className="data-screen-message" role="status">
      Loading match history…
    </p>
  ) : historyQuery.isError && !historyQuery.data ? (
    <div className="data-screen-message" role="alert">
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
      <ol className="data-screen-rows history-rows">
        {historyQuery.data.items.map((match) => (
          <li key={match.matchId}>
            <time className="data-played" dateTime={match.completedAt}>
              {formatMatchDate(match.completedAt)}
            </time>
            <strong className="data-points">{match.score}</strong>
            <span className="data-duration">
              {formatDuration(match.durationSec)}
            </span>
            <strong
              className={`data-result ${
                match.endReason === "time" ? "is-time-up" : "is-defeated"
              }`}
            >
              {match.endReason === "time" ? "TIME UP" : "DEFEATED"}
            </strong>
          </li>
        ))}
      </ol>
      <nav className="data-pagination" aria-label="Match history pages">
        <button
          aria-label="Previous"
          className="data-page-button"
          disabled={historyPage <= 1}
          onClick={() => setHistoryPage((page) => page - 1)}
          type="button"
        >
          <img
            src="/assets/png/default/ui/controls/icon_turn_left.png"
            alt=""
          />
        </button>
        <span>
          Page {historyQuery.data.page} of{" "}
          {Math.max(1, historyQuery.data.totalPages)}
        </span>
        <button
          aria-label="Next"
          className="data-page-button"
          disabled={historyPage >= historyQuery.data.totalPages}
          onClick={() => setHistoryPage((page) => page + 1)}
          type="button"
        >
          <img
            src="/assets/png/default/ui/controls/icon_turn_right.png"
            alt=""
          />
        </button>
      </nav>
    </>
  ) : (
    <p className="data-screen-message">No completed matches in your history.</p>
  );

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

  if (menuTab !== "home") {
    const isRanking = menuTab === "ranking";
    const isFetching = isRanking
      ? rankingQuery.isFetching
      : historyQuery.isFetching;
    const hasData = isRanking ? rankingQuery.data : historyQuery.data;
    const queryError = isRanking ? rankingQuery.isError : historyQuery.isError;
    const retryQuery = isRanking ? rankingQuery.refetch : historyQuery.refetch;

    return (
      <main className="menu-screen data-screen">
        <section
          className="data-screen-panel"
          aria-labelledby="captains-log-title"
          aria-busy={isFetching}
        >
          <header className="data-screen-header">
            <h1 id="captains-log-title">CAPTAIN&apos;S LOG</h1>
            <nav className="data-screen-tabs" aria-label="Match data">
              <button
                aria-pressed={isRanking}
                className={isRanking ? "is-active" : ""}
                onClick={() => {
                  setMenuTab("ranking");
                  setRankingPage(1);
                }}
                type="button"
              >
                Ranking
              </button>
              <button
                aria-pressed={!isRanking}
                className={!isRanking ? "is-active" : ""}
                onClick={() => {
                  setMenuTab("history");
                  setHistoryPage(1);
                }}
                type="button"
              >
                Match History
              </button>
            </nav>
            <p className="data-screen-subtitle">
              {isRanking
                ? `${rankingConfig.match.durationSec} SECOND BATTLES · ${rankingConfig.match.spawnIntervalSec} SECOND SPAWN INTERVAL`
                : "YOUR RECENT BATTLES"}
            </p>
          </header>

          {isFetching && hasData && (
            <p className="data-screen-status" role="status">
              Updating {isRanking ? "ranking" : "match history"}…
            </p>
          )}
          {queryError && hasData && (
            <p className="data-screen-status" role="alert">
              {isRanking
                ? "Ranking refresh failed; showing the last available results."
                : "History refresh failed; showing the last available results."}
              <button
                className="text-action-button"
                onClick={() => void retryQuery()}
                type="button"
              >
                Retry
              </button>
            </p>
          )}

          <div className="data-screen-table">
            <div
              className={`data-screen-columns ${
                isRanking ? "ranking-columns" : "history-columns"
              }`}
              aria-hidden="true"
            >
              {isRanking ? (
                <>
                  <span>RANK</span>
                  <span>CAPTAIN</span>
                  <span>POINTS</span>
                  <span>PLAYED</span>
                </>
              ) : (
                <>
                  <span>DATE</span>
                  <span>POINTS</span>
                  <span>DURATION</span>
                  <span>RESULT</span>
                </>
              )}
            </div>
            {isRanking ? rankingContent : historyContent}
          </div>

          <button
            className="primary-button menu-button data-screen-home"
            onClick={() => setMenuTab("home")}
            type="button"
          >
            MAIN MENU
          </button>
        </section>
      </main>
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
          <div
            className="pending-match-list"
            aria-label="Pending match uploads"
          >
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
        <nav className="menu-data-tabs" aria-label="Match data">
          <button
            aria-pressed={false}
            onClick={() => {
              setMenuTab("ranking");
              setRankingPage(1);
            }}
            type="button"
          >
            Ranking
          </button>
          <button
            aria-pressed={false}
            onClick={() => {
              setMenuTab("history");
              setHistoryPage(1);
            }}
            type="button"
          >
            Match History
          </button>
        </nav>
        <img
          className="menu-ship-decoration"
          src="/assets/png/default/ships/ship_1.png"
          alt=""
        />
        <p className="menu-description">
          Navigate the islands. Survive the battle.
        </p>
      </section>
    </main>
  );
}
