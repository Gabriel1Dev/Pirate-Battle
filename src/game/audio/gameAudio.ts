import type { GameState } from "../sim/types";

const AUDIO_BASE_PATH = "/assets/sounds";

const CANNON_FIRE_SOUNDS = [
  "cannon_fire_1",
  "cannon_fire_2",
  "cannon_fire_3",
] as const;
const WATER_HIT_SOUNDS = [
  "cannonball_water_hit_1",
  "cannonball_water_hit_2",
] as const;
const WOOD_HIT_SOUNDS = ["ship_wood_hit_1", "ship_wood_hit_2"] as const;
const EXPLOSION_SOUNDS = ["ship_explosion_1", "ship_explosion_2"] as const;

type UiSound =
  | "ui_back"
  | "ui_click"
  | "ui_close"
  | "ui_hover"
  | "ui_open";

function playSound(
  name: string,
  volume: number,
  loop = false,
): HTMLAudioElement {
  const audio = new Audio(`${AUDIO_BASE_PATH}/${name}.wav`);
  audio.preload = "auto";
  audio.volume = volume;
  audio.loop = loop;
  audio.addEventListener(
    "error",
    () => {
      console.error(`Unable to load game audio: ${name}.wav`, audio.error);
    },
    { once: true },
  );
  void audio.play().catch((error: unknown) => {
    console.warn(`Unable to play game audio: ${name}.wav`, error);
  });
  return audio;
}

function randomSound(sounds: readonly string[]): string {
  return sounds[Math.floor(Math.random() * sounds.length)];
}

function releaseSound(audio: HTMLAudioElement): void {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

export function playUiSound(name: UiSound): void {
  const volume = name === "ui_hover" ? 0.22 : 0.45;
  playSound(name, volume);
}

export class GameAudio {
  private readonly activeSounds = new Set<HTMLAudioElement>();
  private readonly loops = new Map<string, HTMLAudioElement>();
  private started = false;
  private finished = false;
  private healthWarningPlayed = false;
  private timeWarningPlayed = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.playOneShot("game_start", 0.55);
    this.startLoop("ocean_ambience_loop", 0.22);
    this.startLoop("ship_sailing_loop", 0.3);
  }

  update(previous: GameState, next: GameState): void {
    if (!this.started || this.finished) {
      return;
    }

    const playerShots = next.events.filter(
      (event) => event.type === "shot" && event.owner === "player",
    ).length;
    const enemyShots = next.events.some(
      (event) => event.type === "shot" && event.owner === "enemy",
    );

    if (playerShots > 1) {
      this.playOneShot("cannon_broadside", 0.48);
    } else if (playerShots === 1) {
      this.playOneShot(randomSound(CANNON_FIRE_SOUNDS), 0.45);
    }
    if (enemyShots) {
      this.playOneShot(randomSound(CANNON_FIRE_SOUNDS), 0.36);
    }

    const playerWasHit = next.events.some(
      (event) => event.type === "hit" && event.target === "player",
    );
    const shipCollision = playerWasHit && next.events.some(
      (event) => event.type === "explosion" && event.kind === "chaser",
    );
    if (shipCollision) {
      this.playOneShot("ship_collision", 0.55);
    } else if (playerWasHit) {
      this.playOneShot(randomSound(WOOD_HIT_SOUNDS), 0.48);
    }

    if (
      next.events.some(
        (event) => event.type === "hit" && event.target === "enemy",
      )
    ) {
      this.playOneShot(randomSound(WOOD_HIT_SOUNDS), 0.4);
    }
    if (
      next.events.some(
        (event) => event.type === "hit" && event.target === "island",
      )
    ) {
      this.playOneShot(randomSound(WATER_HIT_SOUNDS), 0.4);
    }

    const destroyedShips = next.events.filter(
      (event) => event.type === "explosion" && event.kind !== "player",
    ).length;
    for (let index = 0; index < destroyedShips; index += 1) {
      this.playOneShot(randomSound(EXPLOSION_SOUNDS), 0.48);
    }
    const scoreGained = Math.max(0, next.score - previous.score);
    for (let index = 0; index < scoreGained; index += 1) {
      this.playOneShot("score_point", 0.38);
    }

    const firstDamageStage = next.config.visual.damageStages[0];
    const previousHealthRatio =
      previous.player.maxHp > 0
        ? previous.player.hp / previous.player.maxHp
        : 0;
    const nextHealthRatio =
      next.player.maxHp > 0 ? next.player.hp / next.player.maxHp : 0;
    if (
      !this.healthWarningPlayed &&
      previousHealthRatio > firstDamageStage &&
      nextHealthRatio <= firstDamageStage
    ) {
      this.healthWarningPlayed = true;
      this.playOneShot("health_low", 0.5);
    }

    if (
      !this.timeWarningPlayed &&
      previous.timeLeftSec > 10 &&
      next.timeLeftSec <= 10
    ) {
      this.timeWarningPlayed = true;
      this.playOneShot("time_warning", 0.5);
    }

    if (next.status === "ended") {
      this.finish(next.endReason === "time");
    }
  }

  pause(): void {
    if (!this.started || this.finished) {
      return;
    }
    this.playOneShot("game_pause", 0.45);
    this.pauseLoops();
  }

  resume(): void {
    if (!this.started || this.finished) {
      return;
    }
    this.playOneShot("game_resume", 0.45);
    this.resumeLoops();
  }

  reset(): void {
    this.dispose();
    this.started = false;
    this.finished = false;
    this.healthWarningPlayed = false;
    this.timeWarningPlayed = false;
    this.start();
  }

  dispose(): void {
    this.started = false;
    this.finished = true;
    for (const audio of this.activeSounds) {
      releaseSound(audio);
    }
    this.activeSounds.clear();
    for (const audio of this.loops.values()) {
      releaseSound(audio);
    }
    this.loops.clear();
  }

  private playOneShot(name: string, volume: number): void {
    const audio = playSound(name, volume);
    this.activeSounds.add(audio);
    audio.addEventListener(
      "ended",
      () => this.activeSounds.delete(audio),
      { once: true },
    );
    audio.addEventListener(
      "error",
      () => this.activeSounds.delete(audio),
      { once: true },
    );
  }

  private startLoop(name: string, volume: number): void {
    const audio = playSound(name, volume, true);
    this.loops.set(name, audio);
  }

  private pauseLoops(): void {
    for (const audio of this.loops.values()) {
      audio.pause();
    }
  }

  private resumeLoops(): void {
    for (const [name, audio] of this.loops) {
      void audio.play().catch((error: unknown) => {
        console.warn(`Unable to resume game audio: ${name}.wav`, error);
      });
    }
  }

  private finish(completed: boolean): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.pauseLoops();
    this.playOneShot(completed ? "game_complete" : "game_over", 0.55);
    if (!completed) {
      this.playOneShot("ship_sinking", 0.55);
    }
  }
}
