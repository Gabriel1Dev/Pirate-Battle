import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  TilingSprite,
  type Texture,
} from "pixi.js";
import type { GameConfig, IslandConfig } from "../config";
import type { GameState, Ship } from "../sim/types";

const SHIP_TEXTURE_PATHS = {
  player: "/assets/png/default/ships/ship_1.png",
  chaser: "/assets/png/default/ships/ship_5.png",
  shooter: "/assets/png/default/ships/ship_10.png",
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
  water: "/assets/png/default/tiles/tile_73.png",
  sand: "/assets/png/default/tiles/tile_72.png",
  grass: "/assets/png/default/tiles/tile_39.png",
  foliage: "/assets/png/default/tiles/tile_68.png",
  plant: "/assets/png/default/tiles/tile_70.png",
  rock: "/assets/png/default/tiles/tile_50.png",
  rockCluster: "/assets/png/default/tiles/tile_55.png",
} as const;

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
  readonly sand: Texture;
  readonly grass: Texture;
  readonly foliage: Texture;
  readonly plant: Texture;
  readonly rock: Texture;
  readonly rockCluster: Texture;
}

interface IslandDetail {
  readonly texture: keyof IslandTextures;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

const ISLAND_DETAILS: readonly (readonly IslandDetail[])[] = [
  [
    { texture: "foliage", x: -0.2, y: -0.1, size: 0.78 },
    { texture: "rockCluster", x: 0.26, y: 0.25, size: 0.55 },
    { texture: "rock", x: -0.35, y: 0.34, size: 0.3 },
  ],
  [
    { texture: "foliage", x: 0.14, y: -0.18, size: 0.74 },
    { texture: "plant", x: -0.32, y: 0.24, size: 0.42 },
    { texture: "rock", x: 0.33, y: 0.34, size: 0.3 },
  ],
  [
    { texture: "foliage", x: -0.23, y: 0.05, size: 0.72 },
    { texture: "plant", x: 0.28, y: -0.2, size: 0.48 },
    { texture: "rockCluster", x: 0.22, y: 0.32, size: 0.54 },
    { texture: "rock", x: -0.38, y: 0.36, size: 0.28 },
  ],
];

export interface GameRenderer {
  readonly application: Application;
  draw(state: GameState): void;
  destroy(): void;
}

function createIslandView(
  island: IslandConfig,
  index: number,
  textures: IslandTextures,
): Container {
  const diameter = island.radius * 2;
  const center = island.radius;
  const islandView = new Container();
  islandView.position.set(island.x - center, island.y - center);

  const sandMask = new Graphics()
    .circle(center, center, island.radius)
    .fill({ color: 0xffffff });
  sandMask.renderable = false;
  const sand = new TilingSprite({
    texture: textures.sand,
    width: diameter,
    height: diameter,
  });
  sand.tileScale.set(1.15);
  sand.mask = sandMask;
  islandView.addChild(sand, sandMask);

  const grassRadius = island.radius * 0.73;
  const grassMask = new Graphics()
    .circle(center, center, grassRadius)
    .fill({ color: 0xffffff });
  grassMask.renderable = false;
  const grass = new TilingSprite({
    texture: textures.grass,
    width: diameter,
    height: diameter,
  });
  grass.tileScale.set(1.08);
  grass.mask = grassMask;
  islandView.addChild(grass, grassMask);

  const coastline = new Graphics()
    .circle(center, center, island.radius - 2)
    .stroke({ color: 0xf0d18a, width: 4, alpha: 0.8 })
    .circle(center, center, grassRadius)
    .stroke({ color: 0x79633c, width: 2, alpha: 0.45 });
  islandView.addChild(coastline);

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

function shipDamageTint(ship: Ship, config: GameConfig): number {
  const healthRatio = ship.maxHp > 0 ? ship.hp / ship.maxHp : 0;
  const [firstStage, secondStage] = config.visual.damageStages;

  if (healthRatio <= secondStage) {
    return 0xff7777;
  }
  if (healthRatio <= firstStage) {
    return 0xffd19a;
  }
  return 0xffffff;
}

export async function initializePixiRenderer(
  host: HTMLElement,
  config: GameConfig,
): Promise<GameRenderer> {
  const [
    playerTexture,
    chaserTexture,
    shooterTexture,
    playerFrameTexture,
    playerGreenTexture,
    playerAmberTexture,
    playerRedTexture,
    enemyFrameTexture,
    enemyGreenTexture,
    enemyRedTexture,
    waterTexture,
    sandTexture,
    grassTexture,
    foliageTexture,
    plantTexture,
    rockTexture,
    rockClusterTexture,
  ] = await Promise.all([
    Assets.load<Texture>(SHIP_TEXTURE_PATHS.player),
    Assets.load<Texture>(SHIP_TEXTURE_PATHS.chaser),
    Assets.load<Texture>(SHIP_TEXTURE_PATHS.shooter),
    Assets.load<Texture>(HEALTH_TEXTURE_PATHS.playerFrame),
    Assets.load<Texture>(HEALTH_TEXTURE_PATHS.playerGreen),
    Assets.load<Texture>(HEALTH_TEXTURE_PATHS.playerAmber),
    Assets.load<Texture>(HEALTH_TEXTURE_PATHS.playerRed),
    Assets.load<Texture>(HEALTH_TEXTURE_PATHS.enemyFrame),
    Assets.load<Texture>(HEALTH_TEXTURE_PATHS.enemyGreen),
    Assets.load<Texture>(HEALTH_TEXTURE_PATHS.enemyRed),
    Assets.load<Texture>(TILE_TEXTURE_PATHS.water),
    Assets.load<Texture>(TILE_TEXTURE_PATHS.sand),
    Assets.load<Texture>(TILE_TEXTURE_PATHS.grass),
    Assets.load<Texture>(TILE_TEXTURE_PATHS.foliage),
    Assets.load<Texture>(TILE_TEXTURE_PATHS.plant),
    Assets.load<Texture>(TILE_TEXTURE_PATHS.rock),
    Assets.load<Texture>(TILE_TEXTURE_PATHS.rockCluster),
  ]);
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

  const world = new Container();
  const water = new TilingSprite({
    texture: waterTexture,
    width: config.arena.width,
    height: config.arena.height,
  });
  const islandLayer = new Container();
  const entityLayer = new Container();
  const projectileGraphics = new Graphics();
  world.addChild(water, islandLayer, entityLayer, projectileGraphics);
  application.stage.addChild(world);
  host.appendChild(application.canvas);

  const islandTextures: IslandTextures = {
    sand: sandTexture,
    grass: grassTexture,
    foliage: foliageTexture,
    plant: plantTexture,
    rock: rockTexture,
    rockCluster: rockClusterTexture,
  };
  for (const [index, island] of config.arena.islands.entries()) {
    islandLayer.addChild(createIslandView(island, index, islandTextures));
  }

  const shipViews = new Map<number, ShipViews>();

  const draw = (state: GameState): void => {
    const screen = application.renderer.screen;
    const scale = Math.min(
      screen.width / config.arena.width,
      screen.height / config.arena.height,
    );
    world.scale.set(scale);
    world.position.set(
      (screen.width - config.arena.width * scale) / 2,
      (screen.height - config.arena.height * scale) / 2,
    );

    const visibleShips = [state.player, ...state.enemies];
    const visibleIds = new Set(visibleShips.map((ship) => ship.id));

    for (const [id, view] of shipViews) {
      if (!visibleIds.has(id)) {
        entityLayer.removeChild(view.sprite, view.healthBar.container);
        view.sprite.destroy();
        view.healthBar.container.destroy({ children: true });
        shipViews.delete(id);
      }
    }

    for (const ship of visibleShips) {
      let view = shipViews.get(ship.id);
      if (!view) {
        const sprite = new Sprite(textureByKind[ship.kind]);
        sprite.anchor.set(0.5);
        const isPlayer = ship.kind === "player";
        const healthBar = createHealthBar(
          isPlayer ? playerFrameTexture : enemyFrameTexture,
          healthFillTexture(ship, healthTextures, config),
        );
        view = { sprite, healthBar };
        shipViews.set(ship.id, view);
        entityLayer.addChild(sprite, healthBar.container);
      }

      view.sprite.position.set(ship.pos.x, ship.pos.y);
      view.sprite.width = ship.radius * 2;
      view.sprite.height = ship.radius * 2;
      view.sprite.rotation = ship.angle + Math.PI / 2;
      view.sprite.tint = shipDamageTint(ship, config);
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
      shipViews.clear();
    },
  };
}
