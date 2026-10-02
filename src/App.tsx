import { useState } from "react";
import "./App.css";
import { GameScreen } from "./ui/GameScreen";

export default function App(): React.JSX.Element {
  const [playing, setPlaying] = useState(false);
  const [gameSeed, setGameSeed] = useState(1);

  if (playing) {
    return (
      <GameScreen
        key={gameSeed}
        onExit={() => setPlaying(false)}
        onRestart={() => setGameSeed((seed) => seed + 1)}
        seed={gameSeed}
      />
    );
  }

  return (
    <main className="menu-screen">
      <div className="menu-card">
        <span className="game-kicker">A captain’s trial</span>
        <h1>Pirate Battle</h1>
        <p>
          Sail through dangerous waters, outmaneuver enemy ships, and make every
          broadside count.
        </p>
        <button
          className="primary-button"
          onClick={() => {
            setGameSeed((seed) => seed + 1);
            setPlaying(true);
          }}
          type="button"
        >
          Start battle
        </button>
        <p className="menu-controls">
          Move: W / ↑ · Turn: A / D · Fire: Space · Broadsides: Q / E
        </p>
      </div>
    </main>
  );
}
