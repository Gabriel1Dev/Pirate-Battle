import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Texture,
  TilingSprite,
} from "pixi.js";
import type { GameConfig, IslandConfig } from "../config";
import type { GameEvent, GameState, Ship } from "../sim/types";

const SHIP_TEXTURE_PATHS = {
  player: "/assets/png/default/ships/ship_1.png",
  chaser: "/assets/png/default/ships/ship_5.png",
  shooter: "/assets/png/default/ships/ship_10.png",
} as const;
const DAMAGED_SAIL_TEXTURE_PATHS = {
  player: "/assets/png/default/ship_parts/sail_large_13.png",
  chaser: "/assets/png/default/ship_parts/sail_large_23.png",
  shooter: "/assets/png/default/ship_parts/sail_large_22.png",
} as const;

const HEALTH_TEXTURE_PATHS = {
  playerFrame: "/assets/png/default/ui/hud/health_frame.png",
  playerGreen: "/assets/png/default/ui/hud/health_fill_green.png",
  playerAmber: "/assets/png/default/ui/hud/health_fill_amber.png",
  playerRed: "/assets/png/default/ui/hud/health_fill_red.png",
  enemyFrame: "/assets/png/default/ui/hud/enemy_health_frame.png",
  enemyGreen: "/assets/png/default/ui/hud/enemy_health_fill_green.png",
  enemyRed: "/assets/png/default/ui/hud/enemy_health_fill_red.png",
} as const;

const TILE_TEXTURE_PATHS = {
  islandSheet: "/assets/tilesheet/tiles_sheet.png",
  water: "/assets/png/default/tiles/tile_73.png",
  foliage: "/assets/png/default/tiles/tile_70.png",
  foliageLarge: "/assets/png/default/tiles/tile_71.png",
  rock: "/assets/png/default/tiles/tile_50.png",
} as const;

const ISLAND_GRASS_FRAME = new Rectangle(384, 128, 64, 64);
const ISLAND_SAND_FRAME = new Rectangle(0, 0, 192, 192);

const EFFECT_TEXTURE_PATHS = {
  fire: [
    "/assets/png/default/effects/fire_1.png",
    "/assets/png/default/effects/fire_2.png",
  ],
  explosion: [
    "/assets/png/default/effects/explosion_1.png",
    "/assets/png/default/effects/explosion_2.png",
    "/assets/png/default/effects/explosion_3.png",
  ],
} as const;

const ASSET_TEXTURE_PATHS = [
  ...Object.values(SHIP_TEXTURE_PATHS),
  ...Object.values(DAMAGED_SAIL_TEXTURE_PATHS),
  ...Object.values(HEALTH_TEXTURE_PATHS),
  ...Object.values(TILE_TEXTURE_PATHS),
  ...Object.values(EFFECT_TEXTURE_PATHS).flat(),
];

const HEALTH_BAR_LAYOUT = {
  player: {
    width: 256,
    height: 48,
    fill: { x: 30, y: 15, width: 196, height: 20 },
  },
  enemy: {
    width: 160,
    height: 40,
    fill: { x: 24, y: 12, width: 112, height: 15 },
  },
} as const;

const WATER_COLOR = 0x15536b;
const PROJECTILE_COLORS = {
  player: 0xffdf77,
  enemy: 0xff725e,
} as const;

interface ShipViews {
  readonly sprite: Sprite;
  readonly fireSprite: Sprite;
  readonly healthBar: HealthBarView;
}

interface HealthBarView {
  readonly container: Container;
  readonly fill: Sprite;
  readonly frame: Sprite;
}

interface HealthTextures {
  readonly playerGreen: Texture;
  readonly playerAmber: Texture;
  readonly playerRed: Texture;
  readonly enemyGreen: Texture;
  readonly enemyRed: Texture;
}

interface IslandTextures {
  readonly base: Texture;
  readonly foliage: Texture;
  readonly foliageLarge: Texture;
  readonly rock: Texture;
}

interface IslandDetail {
  readonly texture: keyof IslandTextures;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

interface EffectView {
  readonly sprite: Sprite;
  readonly textures: readonly Texture[];
  ageSec: number;
  readonly durationSec: number;
  readonly size: number;
}

const ISLAND_DETAILS: readonly (readonly IslandDetail[])[] = [
  [
    { texture: "foliage", x: -0.2, y: -0.1, size: 0.42 },
    { texture: "foliageLarge", x: 0.23, y: 0.24, size: 0.35 },
    { texture: "rock", x: -0.35, y: 0.34, size: 0.23 },
  ],
  [
    { texture: "foliage", x: 0.14, y: -0.18, size: 0.42 },
    { texture: "foliageLarge", x: -0.25, y: 0.25, size: 0.33 },
    { texture: "rock", x: 0.33, y: 0.34, size: 0.23 },
  ],
  [
    { texture: "foliage", x: -0.23, y: 0.05, size: 0.42 },
    { texture: "foliageLarge", x: 0.22, y: 0.3, size: 0.34 },
    { texture: "rock", x: -0.38, y: 0.36, size: 0.22 },
  ],
];

export interface GameRenderer {
  readonly application: Application;
  draw(state: GameState, deltaSeconds?: number): void;
  destroy(): void;
}

function createIslandView(
  island: IslandConfig,
  index: number,
  textures: IslandTextures,
): Container {
  const center = island.radius;
  const islandView = new Container();
  islandView.position.set(island.x - center, island.y - center);

  const ground = new Sprite(textures.base);
  ground.anchor.set(0.5);
  ground.position.set(center, center);
  ground.width = island.radius * 2.35;
  ground.height = island.radius * 2.35;
  islandView.addChild(ground);

  const details = ISLAND_DETAILS[index % ISLAND_DETAILS.length];
  for (const detail of details) {
    const sprite = new Sprite(textures[detail.texture]);
    const size = island.radius * detail.size;
    sprite.anchor.set(0.5);
    sprite.position.set(
      center + island.radius * detail.x,
      center + island.radius * detail.y,
    );
    sprite.width = size;
    sprite.height = size;
    islandView.addChild(sprite);
  }

  return islandView;
}

function createIslandTexture(atlasTexture: Texture): Texture {
  const sandFrame = ISLAND_SAND_FRAME;
  const grassFrame = ISLAND_GRASS_FRAME;
  const size = sandFrame.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to prepare the island grass texture.");
  }

  context.drawImage(
    atlasTexture.source.resource,
    sandFrame.x,
    sandFrame.y,
    sandFrame.width,
    sandFrame.height,
    0,
    0,
    size,
    size,
  );
  context.beginPath();
  context.moveTo(96, 53);
  context.bezierCurveTo(120, 49, 143, 66, 136, 88);
  context.bezierCurveTo(150, 108, 127, 132, 109, 135);
  context.bezierCurveTo(95, 151, 75, 136, 63, 132);
  context.bezierCurveTo(42, 128, 50, 103, 48, 87);
  context.bezierCurveTo(46, 65, 73, 51, 96, 53);
  context.closePath();
  context.clip();
  context.drawImage(
    atlasTexture.source.resource,
    grassFrame.x,
    grassFrame.y,
    grassFrame.width,
    grassFrame.height,
    47,
    51,
    100,
    100,
  );

  return Texture.from(canvas);
}

function createDamagedShipTexture(
  baseTexture: Texture,
  damagedSailTexture: Texture,
): Texture {
  const width = baseTexture.width;
  const height = baseTexture.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const baseImage = baseTexture.source.resource;
  const sailImage = damagedSailTexture.source.resource;

  if (!context) {
    throw new Error("Unable to prepare the damaged ship texture.");
  }

  context.drawImage(baseImage, 0, 0, width, height);
  context.globalCompositeOperation = "destination-out";
  context.beginPath();
  context.moveTo(2, 27);
  context.lineTo(64, 27);
  context.lineTo(62, 54);
  context.lineTo(54, 68);
  context.lineTo(12, 68);
  context.lineTo(4, 54);
  context.closePath();
  context.fill();
  context.globalCompositeOperation = "source-over";
  context.drawImage(sailImage, 0, 24, width, 47);

  return Texture.from(canvas);
}

function createHealthBar(
  frameTexture: Texture,
  fillTexture: Texture,
): HealthBarView {
  const container = new Container();
  const fill = new Sprite(fillTexture);
  const frame = new Sprite(frameTexture);

  container.addChild(frame, fill);

  return { container, fill, frame };
}

function healthFillTexture(
  ship: Ship,
  healthTextures: HealthTextures,
  config: GameConfig,
): Texture {
  const ratio = ship.maxHp > 0 ? ship.hp / ship.maxHp : 0;

  if (ship.kind === "player") {
    const [firstStage, secondStage] = config.visual.damageStages;
    if (ratio <= secondStage) {
      return healthTextures.playerRed;
    }
    return ratio <= firstStage
      ? healthTextures.playerAmber
      : healthTextures.playerGreen;
  }

  return ratio <= 0.5
    ? healthTextures.enemyRed
    : healthTextures.enemyGreen;
}

function drawHealthBar(
  view: HealthBarView,
  ship: Ship,
  healthTextures: HealthTextures,
  config: GameConfig,
): void {
  const isPlayer = ship.kind === "player";
  const layout = isPlayer ? HEALTH_BAR_LAYOUT.player : HEALTH_BAR_LAYOUT.enemy;
  const width = ship.radius * (isPlayer ? 3 : 2.8);
  const scale = width / layout.width;
  const ratio =
    ship.maxHp > 0 ? Math.max(0, Math.min(1, ship.hp / ship.maxHp)) : 0;

  view.fill.texture = healthFillTexture(ship, healthTextures, config);
  view.fill.scale.set(scale * ratio, scale);
  view.frame.scale.set(scale);
  view.container.position.set(
    ship.pos.x - width / 2,
    ship.pos.y - ship.radius - layout.height * scale - 2,
  );
}

export async function initializePixiRenderer(
  host: HTMLElement,
  config: GameConfig,
  onAssetProgress: (progress: number) => void,
): Promise<GameRenderer> {
  let loadedTextures = 0;
  const loadTexture = async (path: string): Promise<Texture> => {
    const texture = await Assets.load<Texture>(path);
    loadedTextures += 1;
    onAssetProgress((loadedTextures / ASSET_TEXTURE_PATHS.length) * 0.9);
    return texture;
  };

  const [
    playerTexture,
    damagedPlayerSailTexture,
    chaserTexture,
    damagedChaserSailTexture,
    shooterTexture,
    damagedShooterSailTexture,
    playerFrameTexture,
    playerGreenTexture,
    playerAmberTexture,
    playerRedTexture,
    enemyFrameTexture,
    enemyGreenTexture,
    enemyRedTexture,
    waterTexture,
    islandSheetTexture,
    foliageTexture,
    foliageLargeTexture,
    rockTexture,
    fireTextureOne,
    fireTextureTwo,
    explosionTextureOne,
    explosionTextureTwo,
    explosionTextureThree,
  ] = await Promise.all([
    loadTexture(SHIP_TEXTURE_PATHS.player),
    loadTexture(DAMAGED_SAIL_TEXTURE_PATHS.player),
    loadTexture(SHIP_TEXTURE_PATHS.chaser),
    loadTexture(DAMAGED_SAIL_TEXTURE_PATHS.chaser),
    loadTexture(SHIP_TEXTURE_PATHS.shooter),
    loadTexture(DAMAGED_SAIL_TEXTURE_PATHS.shooter),
    loadTexture(HEALTH_TEXTURE_PATHS.playerFrame),
    loadTexture(HEALTH_TEXTURE_PATHS.playerGreen),
    loadTexture(HEALTH_TEXTURE_PATHS.playerAmber),
    loadTexture(HEALTH_TEXTURE_PATHS.playerRed),
    loadTexture(HEALTH_TEXTURE_PATHS.enemyFrame),
    loadTexture(HEALTH_TEXTURE_PATHS.enemyGreen),
    loadTexture(HEALTH_TEXTURE_PATHS.enemyRed),
    loadTexture(TILE_TEXTURE_PATHS.water),
    loadTexture(TILE_TEXTURE_PATHS.islandSheet),
    loadTexture(TILE_TEXTURE_PATHS.foliage),
    loadTexture(TILE_TEXTURE_PATHS.foliageLarge),
    loadTexture(TILE_TEXTURE_PATHS.rock),
    ...EFFECT_TEXTURE_PATHS.fire.map(loadTexture),
    ...EFFECT_TEXTURE_PATHS.explosion.map(loadTexture),
  ]);
  const damagedTextureByKind = {
    player: createDamagedShipTexture(playerTexture, damagedPlayerSailTexture),
    chaser: createDamagedShipTexture(chaserTexture, damagedChaserSailTexture),
    shooter: createDamagedShipTexture(shooterTexture, damagedShooterSailTexture),
  };
  const islandTextures: IslandTextures = {
    base: createIslandTexture(islandSheetTexture),
    foliage: foliageTexture,
    foliageLarge: foliageLargeTexture,
    rock: rockTexture,
  };
  const textureByKind = {
    player: playerTexture,
    chaser: chaserTexture,
    shooter: shooterTexture,
  };
  const healthTextures = {
    playerGreen: playerGreenTexture,
    playerAmber: playerAmberTexture,
    playerRed: playerRedTexture,
    enemyGreen: enemyGreenTexture,
    enemyRed: enemyRedTexture,
  };
  const application = new Application();
  await application.init({
    width: config.arena.width,
    height: config.arena.height,
    backgroundColor: WATER_COLOR,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio,
    resizeTo: host,
  });
  onAssetProgress(1);

  const world = new Container();
  const water = new TilingSprite({
    texture: waterTexture,
    width: config.arena.width,
    height: config.arena.height,
  });
  const islandLayer = new Container();
  const effectLayer = new Container();
  const entityLayer = new Container();
  const projectileGraphics = new Graphics();
  world.addChild(
    water,
    islandLayer,
    effectLayer,
    entityLayer,
    projectileGraphics,
  );
  application.stage.addChild(world);
  host.appendChild(application.canvas);

  for (const [index, island] of config.arena.islands.entries()) {
    islandLayer.addChild(createIslandView(island, index, islandTextures));
  }

  const shipViews = new Map<number, ShipViews>();
  const effectViews: EffectView[] = [];
  const processedStates = new WeakSet<GameState>();

  const addEffect = (
    event: GameEvent,
  ): void => {
    let textures: readonly Texture[];
    let durationSec: number;
    let size: number;

    if (event.type === "shot") {
      textures = [fireTextureOne, fireTextureTwo];
      durationSec = config.visual.shotEffectDurationSec;
      size = config.visual.shotEffectSize;
    } else if (event.type === "hit") {
      textures = [explosionTextureThree];
      durationSec = config.visual.hitEffectDurationSec;
      size = config.visual.hitEffectSize;
    } else {
      const explosionTextures = {
        player: [
          explosionTextureThree,
          explosionTextureTwo,
          explosionTextureOne,
        ],
        chaser: [
          explosionTextureOne,
          explosionTextureTwo,
          explosionTextureThree,
        ],
        shooter: [
          explosionTextureTwo,
          explosionTextureThree,
          explosionTextureOne,
        ],
      };
      textures = explosionTextures[event.kind];
      durationSec = config.visual.explosionEffectDurationSec;
      size = config.visual.explosionEffectSize;
    }

    const sprite = new Sprite(textures[0]);
    sprite.anchor.set(0.5);
    sprite.position.set(event.pos.x, event.pos.y);
    if (event.type === "shot") {
      sprite.rotation = event.angle;
    }
    effectLayer.addChild(sprite);
    effectViews.push({ sprite, textures, ageSec: 0, durationSec, size });
  };

  const draw = (state: GameState, deltaSeconds = 0): void => {
    const screen = application.renderer.screen;
    const scale = Math.max(
      screen.width / config.arena.width,
      screen.height / config.arena.height,
    );
    world.scale.set(scale);
    world.position.set(
      (screen.width - config.arena.width * scale) / 2,
      (screen.height - config.arena.height * scale) / 2,
    );

    if (!processedStates.has(state)) {
      for (const event of state.events) {
        addEffect(event);
      }
      processedStates.add(state);
    }

    for (let index = effectViews.length - 1; index >= 0; index -= 1) {
      const effect = effectViews[index];
      if (state.status !== "paused") {
        effect.ageSec += deltaSeconds;
      }
      const progress = effect.ageSec / effect.durationSec;
      if (progress >= 1) {
        effectLayer.removeChild(effect.sprite);
        effect.sprite.destroy();
        effectViews.splice(index, 1);
        continue;
      }

      const clampedProgress = Math.max(0, progress);
      const frameIndex = Math.min(
        effect.textures.length - 1,
        Math.floor(clampedProgress * effect.textures.length),
      );
      const scale =
        config.visual.effectStartScale +
        (config.visual.effectEndScale - config.visual.effectStartScale) *
          clampedProgress;
      effect.sprite.texture = effect.textures[frameIndex];
      effect.sprite.width = effect.size * scale;
      effect.sprite.height = effect.size * scale;
      effect.sprite.alpha = 1 - clampedProgress;
    }

    const visibleShips = [state.player, ...state.enemies];
    const visibleIds = new Set(visibleShips.map((ship) => ship.id));

    for (const [id, view] of shipViews) {
      if (!visibleIds.has(id)) {
        entityLayer.removeChild(
          view.sprite,
          view.fireSprite,
          view.healthBar.container,
        );
        view.sprite.destroy();
        view.fireSprite.destroy();
        view.healthBar.container.destroy({ children: true });
        shipViews.delete(id);
      }
    }

    for (const ship of visibleShips) {
      let view = shipViews.get(ship.id);
      if (!view) {
        const sprite = new Sprite(textureByKind[ship.kind]);
        sprite.anchor.set(0.5);
        const fireSprite = new Sprite(fireTextureOne);
        fireSprite.anchor.set(0.5);
        fireSprite.visible = false;
        const isPlayer = ship.kind === "player";
        const healthBar = createHealthBar(
          isPlayer ? playerFrameTexture : enemyFrameTexture,
          healthFillTexture(ship, healthTextures, config),
        );
        view = { sprite, fireSprite, healthBar };
        shipViews.set(ship.id, view);
        entityLayer.addChild(sprite, fireSprite, healthBar.container);
      }

      view.sprite.position.set(ship.pos.x, ship.pos.y);
      view.sprite.width = ship.radius * 2;
      view.sprite.height = ship.radius * 2;
      view.sprite.rotation = ship.angle + Math.PI / 2;
      const healthRatio = ship.maxHp > 0 ? ship.hp / ship.maxHp : 1;
      const [firstDamageStage] = config.visual.damageStages;
      const isDamaged = healthRatio <= firstDamageStage;
      view.sprite.texture =
        isDamaged
          ? damagedTextureByKind[ship.kind]
          : textureByKind[ship.kind];
      const fireRotation = ship.angle + Math.PI / 2;
      const fireOffsetX = ship.radius * 0.35;
      const fireOffsetY = -ship.radius * 0.2;
      view.fireSprite.position.set(
        ship.pos.x +
          fireOffsetX * Math.cos(fireRotation) -
          fireOffsetY * Math.sin(fireRotation),
        ship.pos.y +
          fireOffsetX * Math.sin(fireRotation) +
          fireOffsetY * Math.cos(fireRotation),
      );
      view.fireSprite.rotation = fireRotation;
      view.fireSprite.width = ship.radius * 0.75;
      view.fireSprite.height = ship.radius * 0.8;
      view.fireSprite.texture =
        Math.floor(state.elapsedSec * 8) % 2 === 0
          ? fireTextureOne
          : fireTextureTwo;
      view.fireSprite.visible = isDamaged;
      drawHealthBar(view.healthBar, ship, healthTextures, config);
    }

    projectileGraphics.clear();
    for (const projectile of state.projectiles) {
      projectileGraphics
        .circle(projectile.pos.x, projectile.pos.y, projectile.radius)
        .fill(PROJECTILE_COLORS[projectile.owner]);
    }

  };

  return {
    application,
    draw,
    destroy(): void {
      application.destroy({ removeView: true }, { children: true });
      Object.values(damagedTextureByKind).forEach((texture) =>
        texture.destroy(true),
      );
      islandTextures.base.destroy(true);
      shipViews.clear();
    },
  };
}
