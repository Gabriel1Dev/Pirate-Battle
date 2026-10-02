import { create } from "zustand";
import type { HudSnapshot } from "../game/sim/types";

interface GameStore {
  hud: HudSnapshot | null;
  setHud(snapshot: HudSnapshot): void;
}

export const useGameStore = create<GameStore>((set) => ({
  hud: null,
  setHud(snapshot): void {
    set({ hud: snapshot });
  },
}));
