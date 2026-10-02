export interface Vec2 {
  x: number;
  y: number;
}

export interface WeaponConfig {
  cooldownSec: number;
  damage: number;
  projectileSpeed: number; // px/s
  projectileLifetimeSec: number;
  projectileRadius: number;
}

export interface BroadsideConfig extends WeaponConfig {
  projectileCount: number; // parallel projectiles per side
  spacing: number; // px between parallel projectiles
}

export interface ShipConfig {
  maxHp: number;
  speed: number; // px/s
  turnSpeed: number; // rad/s
  radius: number;
}

export interface IslandConfig {
  x: number;
  y: number;
  radius: number;
}

export interface GameConfig {
  step: { fixedStepSec: number; maxFrameSec: number };
  match: { durationSec: number; spawnIntervalSec: number };
  scoring: { pointsPerEnemy: number };
  arena: {
    width: number;
    height: number;
    playerStart: Vec2;
    playerStartAngle: number; // radians, 0 = facing +x (right)
    islands: readonly IslandConfig[];
  };
  player: ShipConfig & {
    front: WeaponConfig;
    broadside: BroadsideConfig;
  };
  chaser: ShipConfig & { contactDamage: number };
  shooter: ShipConfig & {
    attackRange: number; // fires when player is within this distance
    keepDistance: number; // stops approaching at this distance
    weapon: WeaponConfig;
  };
  spawn: {
    minDistanceFromPlayer: number;
    edgeMargin: number;
    maxAttempts: number;
    weights: { chaser: number; shooter: number };
  };
  visual: {
    damageStages: readonly number[]; // hp ratios where the ship sprite degrades
  };
}

export const DEFAULT_CONFIG: GameConfig = {
  step: { fixedStepSec: 1 / 60, maxFrameSec: 0.25 },
  match: { durationSec: 90, spawnIntervalSec: 3 },
  scoring: { pointsPerEnemy: 1 },
  arena: {
    width: 1280,
    height: 720,
    playerStart: { x: 160, y: 360 },
    playerStartAngle: 0,
    islands: [
      { x: 420, y: 360, radius: 70 },
      { x: 880, y: 210, radius: 60 },
      { x: 900, y: 530, radius: 80 },
    ],
  },
  player: {
    maxHp: 100,
    speed: 180,
    turnSpeed: 2.5,
    radius: 22,
    front: {
      cooldownSec: 0.4,
      damage: 10,
      projectileSpeed: 420,
      projectileLifetimeSec: 1.5,
      projectileRadius: 5,
    },
    broadside: {
      cooldownSec: 1.2,
      damage: 8,
      projectileSpeed: 380,
      projectileLifetimeSec: 1.2,
      projectileRadius: 5,
      projectileCount: 3,
      spacing: 14,
    },
  },
  chaser: {
    maxHp: 20,
    speed: 120,
    turnSpeed: 2,
    radius: 20,
    contactDamage: 25,
  },
  shooter: {
    maxHp: 30,
    speed: 90,
    turnSpeed: 1.8,
    radius: 22,
    attackRange: 350,
    keepDistance: 250,
    weapon: {
      cooldownSec: 1.8,
      damage: 8,
      projectileSpeed: 300,
      projectileLifetimeSec: 1.6,
      projectileRadius: 5,
    },
  },
  spawn: {
    minDistanceFromPlayer: 300,
    edgeMargin: 40,
    maxAttempts: 20,
    weights: { chaser: 0.5, shooter: 0.5 },
  },
  visual: { damageStages: [0.66, 0.33] },
};

/** Limits for the Options screen (documented in README). */
export const LIMITS = {
  durationSec: { min: 60, max: 180 },
  spawnIntervalSec: { min: 1, max: 10 },
} as const;

/** The two values the player can change in Options. */
export interface MatchOptions {
  durationSec: number;
  spawnIntervalSec: number;
}

export const DEFAULT_OPTIONS: MatchOptions = {
  durationSec: DEFAULT_CONFIG.match.durationSec,
  spawnIntervalSec: DEFAULT_CONFIG.match.spawnIntervalSec,
};

export type OptionsErrors = Partial<Record<keyof MatchOptions, string>>;

export function validateOptions(options: MatchOptions): OptionsErrors {
  const errors: OptionsErrors = {};
  const { durationSec: d, spawnIntervalSec: s } = LIMITS;

  if (
    !Number.isFinite(options.durationSec) ||
    options.durationSec < d.min ||
    options.durationSec > d.max
  ) {
    errors.durationSec = `Game session time must be between ${d.min} and ${d.max} seconds.`;
  }
  if (
    !Number.isFinite(options.spawnIntervalSec) ||
    options.spawnIntervalSec < s.min ||
    options.spawnIntervalSec > s.max
  ) {
    errors.spawnIntervalSec = `Enemy spawn time must be between ${s.min} and ${s.max} seconds.`;
  }
  return errors;
}

/**
 * Builds the config snapshot used by ONE match.
 * Deep copy: later changes to options never affect a running match.
 */
export function createMatchConfig(
  options: MatchOptions,
  base: GameConfig = DEFAULT_CONFIG,
): GameConfig {
  const snapshot = structuredClone(base);
  snapshot.match.durationSec = options.durationSec;
  snapshot.match.spawnIntervalSec = options.spawnIntervalSec;
  return snapshot;
}
