export interface ProjectileConfig {
  readonly speed: number;
  readonly damage: number;
  readonly radius: number;
  readonly lifetimeSeconds: number;
  readonly range: number;
}

export interface WeaponConfig extends ProjectileConfig {
  readonly cooldownSeconds: number;
  readonly projectileCount: number;
  readonly parallelSpacing: number;
}

export interface IslandConfig {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface GameConfig {
  readonly simulation: {
    readonly fixedTimeStepSeconds: number;
    readonly maxFrameDeltaSeconds: number;
    readonly maxSubStepsPerFrame: number;
    readonly hudUpdateIntervalSeconds: number;
  };
  readonly match: {
    readonly durationSeconds: number;
  };
  readonly arena: {
    readonly width: number;
    readonly height: number;
    readonly boundaryMargin: number;
    readonly islands: readonly IslandConfig[];
  };
  readonly player: {
    readonly health: number;
    readonly radius: number;
    readonly movementSpeed: number;
    readonly rotationSpeedRadiansPerSecond: number;
    readonly frontWeapon: WeaponConfig;
    readonly broadsideWeapon: WeaponConfig;
  };
  readonly enemies: {
    readonly chaser: {
      readonly health: number;
      readonly radius: number;
      readonly movementSpeed: number;
      readonly rotationSpeedRadiansPerSecond: number;
      readonly collisionDamage: number;
    };
    readonly shooter: {
      readonly health: number;
      readonly radius: number;
      readonly movementSpeed: number;
      readonly rotationSpeedRadiansPerSecond: number;
      readonly attackRange: number;
      readonly weapon: WeaponConfig;
    };
    readonly spawn: {
      readonly intervalSeconds: number;
      readonly minimumDistanceFromPlayer: number;
      readonly edgeMargin: number;
      readonly maximumPlacementAttempts: number;
      readonly chaserWeight: number;
      readonly shooterWeight: number;
    };
  };
}

export const LIMITS = {
  matchDurationSeconds: {
    min: 60,
    max: 180,
  },
  enemySpawnIntervalSeconds: {
    min: 1,
    max: 30,
  },
} as const;

export const DEFAULT_GAME_CONFIG: GameConfig = {
  simulation: {
    fixedTimeStepSeconds: 1 / 60,
    maxFrameDeltaSeconds: 0.25,
    maxSubStepsPerFrame: 8,
    hudUpdateIntervalSeconds: 0.1,
  },
  match: {
    durationSeconds: 120,
  },
  arena: {
    width: 1600,
    height: 900,
    boundaryMargin: 24,
    islands: [
      { x: 650, y: 350, width: 220, height: 160 },
      { x: 1120, y: 610, width: 180, height: 130 },
    ],
  },
  player: {
    health: 100,
    radius: 24,
    movementSpeed: 240,
    rotationSpeedRadiansPerSecond: 3,
    frontWeapon: {
      cooldownSeconds: 0.35,
      projectileCount: 1,
      parallelSpacing: 0,
      speed: 520,
      damage: 20,
      radius: 5,
      lifetimeSeconds: 1.5,
      range: 780,
    },
    broadsideWeapon: {
      cooldownSeconds: 1.2,
      projectileCount: 3,
      parallelSpacing: 18,
      speed: 460,
      damage: 15,
      radius: 5,
      lifetimeSeconds: 1.5,
      range: 690,
    },
  },
  enemies: {
    chaser: {
      health: 40,
      radius: 22,
      movementSpeed: 150,
      rotationSpeedRadiansPerSecond: 2.4,
      collisionDamage: 25,
    },
    shooter: {
      health: 50,
      radius: 24,
      movementSpeed: 110,
      rotationSpeedRadiansPerSecond: 1.8,
      attackRange: 420,
      weapon: {
        cooldownSeconds: 1.4,
        projectileCount: 1,
        parallelSpacing: 0,
        speed: 330,
        damage: 12,
        radius: 5,
        lifetimeSeconds: 2,
        range: 660,
      },
    },
    spawn: {
      intervalSeconds: 5,
      minimumDistanceFromPlayer: 360,
      edgeMargin: 48,
      maximumPlacementAttempts: 24,
      chaserWeight: 0.6,
      shooterWeight: 0.4,
    },
  },
};

export const createGameConfigSnapshot = (
  config: GameConfig = DEFAULT_GAME_CONFIG,
): GameConfig => structuredClone(config);
