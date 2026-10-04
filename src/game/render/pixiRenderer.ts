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
import { getIslandOutline, getIslandShapeScale } from "../islandShape";
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
  foliage: "/assets/png/default/tiles/tile_72.png",
  foliageLarge: "/assets/png/default/tiles/tile_71.png",
  rock: "/assets/png/default/tiles/tile_50.png",
} as const;
const CANNONBALL_TEXTURE_PATH = "/assets/png/default/ship_parts/cannon_ball.png";
const MISC_TEXTURE_PATH =
  "/assets/spritesheet/ships_miscellaneous_sheet.png";

const ISLAND_BASE_FRAME = new Rectangle(320, 0, 256, 256);
const MISC_FRAMES = {
  cannon: new Rectangle(88, 422, 29, 16),
  cannonLoose: new Rectangle(439, 496, 20, 12),
  dinghy: new Rectangle(606, 145, 20, 38),
  crew1: new Rectangle(511, 489, 22, 20),
  crew2: new Rectangle(463, 489, 22, 20),
  crew3: new Rectangle(487, 489, 22, 20),
  hull1: new Rectangle(596, 316, 50, 108),
  hull2: new Rectangle(544, 206, 50, 108),
  hull3: new Rectangle(596, 206, 50, 108),
  sail1: new Rectangle(408, 279, 66, 47),
  sail2: new Rectangle(476, 0, 66, 47),
  wood: new Rectangle(408, 472, 26, 10),
  wood1: new Rectangle(88, 449, 15, 7),
  wood2: new Rectangle(408, 472, 26, 10),
  wood3: new Rectangle(116, 440, 15, 10),
  wood4: new Rectangle(88, 440, 26, 7),
} as const;
const DESTRUCTION_EFFECT_LIFETIME_SEC = 1.35;
const WRECK_LIFETIME_SEC = 24;
const MAX_DESTRUCTION_EFFECTS = 6;

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
  MISC_TEXTURE_PATH,
  CANNONBALL_TEXTURE_PATH,
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
interface ShipViews {
  readonly sprite: Sprite;
  readonly fireSprite: Sprite;
  readonly healthBar: HealthBarView;
}

interface WreckView {
  readonly container: Container;
  readonly crew: readonly Sprite[];
  readonly originX: number;
  readonly originY: number;
  ageSec: number;
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
  readonly cannon: Texture;
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

interface DestructionFragment {
  readonly sprite: Sprite;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly initialRotation: number;
  readonly angularVelocity: number;
}

interface DestructionView {
  readonly container: Container;
  readonly explosion: Sprite;
  readonly explosionTextures: readonly Texture[];
  readonly explosionSize: number;
  readonly explosionDurationSec: number;
  readonly fragments: readonly DestructionFragment[];
  ageSec: number;
}

interface DestructionTextures {
  readonly hulls: readonly Texture[];
  readonly sails: readonly Texture[];
  readonly wood: readonly Texture[];
  readonly cannon: Texture;
  readonly dinghy: Texture;
  readonly crew: readonly Texture[];
}

const ISLAND_DETAILS: readonly (readonly IslandDetail[])[] = [
  [
    { texture: "foliage", x: -0.2, y: -0.08, size: 0.88 },
    { texture: "foliageLarge", x: 0.23, y: 0.18, size: 0.76 },
    { texture: "foliageLarge", x: -0.08, y: 0.39, size: 0.58 },
    { texture: "rock", x: -0.39, y: 0.35, size: 0.26 },
    { texture: "rock", x: 0.38, y: -0.34, size: 0.22 },
  ],
  [
    { texture: "foliage", x: 0.14, y: -0.16, size: 0.88 },
    { texture: "foliageLarge", x: -0.27, y: 0.2, size: 0.76 },
    { texture: "foliageLarge", x: 0.04, y: 0.39, size: 0.58 },
    { texture: "rock", x: 0.39, y: 0.35, size: 0.26 },
    { texture: "rock", x: -0.38, y: -0.34, size: 0.22 },
  ],
  [
    { texture: "foliage", x: -0.23, y: 0.04, size: 0.88 },
    { texture: "foliageLarge", x: 0.24, y: 0.22, size: 0.76 },
    { texture: "foliageLarge", x: -0.02, y: -0.39, size: 0.58 },
    { texture: "rock", x: -0.39, y: 0.35, size: 0.26 },
    { texture: "rock", x: 0.38, y: -0.34, size: 0.22 },
  ],
];

export interface GameRenderer {
  readonly application: Application;
  draw(state: GameState, deltaSeconds?: number): void;
  getCameraTransform(): { readonly x: number; readonly y: number; readonly scale: number };
  getCreatedDestructionFragmentCount(): number;
  getRenderedShipIds(): readonly number[];
  getWreckCount(): number;
  destroy(): void;
}

function createDestructionView(
  position: { readonly x: number; readonly y: number },
  kind: Ship["kind"],
  radius: number,
  textures: DestructionTextures,
  explosionTextures: readonly Texture[],
  config: GameConfig,
): DestructionView {
  const container = new Container();
  container.position.set(position.x, position.y);
  const explosion = new Sprite(explosionTextures[0]);
  explosion.anchor.set(0.5);
  container.addChild(explosion);

  const direction = kind === "chaser" ? -1 : 1;
  const parts = [
    {
      texture: textures.hulls[0],
      offsetX: -radius * 0.28,
      offsetY: -radius * 0.12,
      width: radius * 0.72,
      height: radius * 1.35,
      velocityX: -48 * direction,
      velocityY: -72,
      rotation: -0.3,
      spin: -3.8,
    },
    {
      texture: textures.hulls[1],
      offsetX: radius * 0.25,
      offsetY: radius * 0.08,
      width: radius * 0.64,
      height: radius * 1.2,
      velocityX: 54 * direction,
      velocityY: -57,
      rotation: 0.2,
      spin: 3.2,
    },
    {
      texture: textures.sails[kind === "player" ? 0 : 1],
      offsetX: 0,
      offsetY: -radius * 0.48,
      width: radius * 1.3,
      height: radius * 0.8,
      velocityX: 14 * direction,
      velocityY: -102,
      rotation: -0.15,
      spin: -2.7 * direction,
    },
    {
      texture: textures.wood[0],
      offsetX: -radius * 0.12,
      offsetY: radius * 0.3,
      width: radius * 0.82,
      height: radius * 0.32,
      velocityX: -76 * direction,
      velocityY: -34,
      rotation: 0.5,
      spin: 4.8,
    },
    {
      texture: textures.wood[1],
      offsetX: radius * 0.18,
      offsetY: radius * 0.36,
      width: radius * 0.66,
      height: radius * 0.28,
      velocityX: 70 * direction,
      velocityY: -22,
      rotation: -0.4,
      spin: -5.2,
    },
    {
      texture: textures.cannon,
      offsetX: radius * 0.34,
      offsetY: -radius * 0.08,
      width: radius * 0.58,
      height: radius * 0.34,
      velocityX: 62 * direction,
      velocityY: -83,
      rotation: 0.1,
      spin: 5.7,
    },
    {
      texture: textures.hulls[2],
      offsetX: -radius * 0.36,
      offsetY: radius * 0.24,
      width: radius * 0.55,
      height: radius * 0.95,
      velocityX: -58 * direction,
      velocityY: -12,
      rotation: -0.2,
      spin: -4.4,
    },
  ] as const;

  const fragments = parts.map((part) => {
    const sprite = new Sprite(part.texture);
    sprite.anchor.set(0.5);
    sprite.position.set(part.offsetX, part.offsetY);
    sprite.width = part.width;
    sprite.height = part.height;
    sprite.rotation = part.rotation;
    container.addChild(sprite);
    return {
      sprite,
      offsetX: part.offsetX,
      offsetY: part.offsetY,
      velocityX: part.velocityX,
      velocityY: part.velocityY,
      initialRotation: part.rotation,
      angularVelocity: part.spin,
    };
  });

  return {
    container,
    explosion,
    explosionTextures,
    explosionSize: Math.max(config.visual.explosionEffectSize, radius * 3.6),
    explosionDurationSec: Math.max(
      config.visual.explosionEffectDurationSec,
      0.72,
    ),
    fragments,
    ageSec: 0,
  };
}

function createWreckView(
  position: { readonly x: number; readonly y: number },
  textures: DestructionTextures,
): WreckView {
  const container = new Container();
  container.position.set(position.x, position.y);

  const dinghy = new Sprite(textures.dinghy);
  dinghy.anchor.set(0.5);
  dinghy.position.set(2, -2);
  dinghy.width = 28;
  dinghy.height = 54;
  dinghy.rotation = -0.16;
  container.addChild(dinghy);

  const crewPositions = [
    { x: -3, y: -10 },
    { x: 4, y: 1 },
    { x: -27, y: 23 },
  ] as const;
  const crew = textures.crew.map((texture, index) => {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.position.set(crewPositions[index].x, crewPositions[index].y);
    sprite.width = 11;
    sprite.height = 10;
    container.addChild(sprite);
    return sprite;
  });

  for (const [index, texture] of textures.wood.slice(0, 2).entries()) {
    const plank = new Sprite(texture);
    plank.anchor.set(0.5);
    plank.position.set(index === 0 ? 28 : -32, index === 0 ? -21 : -14);
    plank.width = index === 0 ? 18 : 14;
    plank.height = 6;
    plank.rotation = index === 0 ? 0.7 : -0.3;
    container.addChild(plank);
  }

  return {
    container,
    crew,
    originX: position.x,
    originY: position.y,
    ageSec: 0,
  };
}

function createIslandView(
  island: IslandConfig,
  index: number,
  textures: IslandTextures,
): Container {
  const center = island.radius;
  const islandView = new Container();
  islandView.position.set(island.x - center, island.y - center);

  const shape = getIslandShapeScale(index);
  const islandSize = island.radius * 2.75;
  for (const [ringIndex, ring] of [1.2, 1.1].entries()) {
    const shoreline = new Graphics();
    const points = getIslandOutline(
      island.radius,
      index,
      (islandSize / (2 * island.radius)) * ring,
    ).flatMap((point) => [center + point.x, center + point.y]);
    shoreline.poly(points).fill({
      color: ringIndex === 0 ? 0x76dce5 : 0xb7f0df,
      alpha: ringIndex === 0 ? 0.18 : 0.2,
    });
    islandView.addChild(shoreline);
  }

  const ground = new Sprite(textures.base);
  ground.anchor.set(0.5);
  ground.position.set(center, center);
  ground.width = islandSize * shape.scaleX;
  ground.height = islandSize * shape.scaleY;
  islandView.addChild(ground);

  const details = ISLAND_DETAILS[index % ISLAND_DETAILS.length];
  for (const [detailIndex, detail] of details.entries()) {
    const sprite = new Sprite(textures[detail.texture]);
    const size = island.radius * detail.size;
    sprite.anchor.set(0.5);
    sprite.position.set(
      center + island.radius * detail.x,
      center + island.radius * detail.y,
    );
    sprite.width = size;
    sprite.height = size;
    sprite.rotation = ((detailIndex + index) % 2 === 0 ? -1 : 1) * 0.12;
    islandView.addChild(sprite);
  }

  const cannon = new Sprite(textures.cannon);
  cannon.anchor.set(0.5);
  cannon.position.set(center + island.radius * 0.42, center - island.radius * 0.2);
  cannon.width = island.radius * 0.72;
  cannon.height = island.radius * 0.4;
  cannon.rotation = (index % 2 === 0 ? -1 : 1) * 0.25;
  islandView.addChild(cannon);

  return islandView;
}

function createFrameTexture(
  atlasTexture: Texture,
  frame: Rectangle,
): Texture {
  return new Texture({ source: atlasTexture.source, frame });
}

function createIslandTexture(atlasTexture: Texture): Texture {
  const frame = ISLAND_BASE_FRAME;
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to prepare the island texture.");
  }

  context.beginPath();
  context.moveTo(128, 4);
  context.bezierCurveTo(171, -2, 232, 13, 250, 54);
  context.bezierCurveTo(268, 91, 249, 119, 253, 151);
  context.bezierCurveTo(250, 198, 220, 240, 178, 249);
  context.bezierCurveTo(143, 263, 111, 242, 75, 251);
  context.bezierCurveTo(35, 242, 7, 210, 12, 170);
  context.bezierCurveTo(-1, 137, 9, 105, 4, 77);
  context.bezierCurveTo(13, 38, 52, 8, 94, 13);
  context.bezierCurveTo(107, 7, 118, 4, 128, 4);
  context.closePath();
  context.clip();
  context.drawImage(
    atlasTexture.source.resource,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    0,
    0,
    frame.width,
    frame.height,
  );

  const softenedTexture = document.createElement("canvas");
  softenedTexture.width = frame.width;
  softenedTexture.height = frame.height;
  const softenedContext = softenedTexture.getContext("2d");
  if (!softenedContext) {
    throw new Error("Unable to blend the island texture seams.");
  }
  softenedContext.filter = "blur(16px)";
  softenedContext.drawImage(canvas, 0, 0);
  softenedContext.filter = "none";

  for (const axis of ["x", "y"] as const) {
    const seamMask = document.createElement("canvas");
    seamMask.width = frame.width;
    seamMask.height = frame.height;
    const maskContext = seamMask.getContext("2d");
    if (!maskContext) {
      throw new Error("Unable to prepare the island seam mask.");
    }

    const gradient =
      axis === "x"
        ? maskContext.createLinearGradient(0, 0, frame.width, 0)
        : maskContext.createLinearGradient(0, 0, 0, frame.height);
    const seamPosition = 0.5;
    const feather = 28 / frame.width;
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(seamPosition - feather, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(seamPosition, "rgba(0, 0, 0, 0.9)");
    gradient.addColorStop(seamPosition + feather, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    maskContext.fillStyle = gradient;
    maskContext.fillRect(0, 0, frame.width, frame.height);

    const seamBlend = document.createElement("canvas");
    seamBlend.width = frame.width;
    seamBlend.height = frame.height;
    const blendContext = seamBlend.getContext("2d");
    if (!blendContext) {
      throw new Error("Unable to blend the island texture seams.");
    }
    blendContext.drawImage(softenedTexture, 0, 0);
    blendContext.globalCompositeOperation = "destination-in";
    blendContext.drawImage(seamMask, 0, 0);
    context.drawImage(seamBlend, 0, 0);
  }

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
    cannonballTexture,
    miscellaneousTexture,
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
    loadTexture(CANNONBALL_TEXTURE_PATH),
    loadTexture(MISC_TEXTURE_PATH),
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
  const destructionTextures: DestructionTextures = {
    hulls: [MISC_FRAMES.hull1, MISC_FRAMES.hull2, MISC_FRAMES.hull3].map(
      (frame) => createFrameTexture(miscellaneousTexture, frame),
    ),
    sails: [MISC_FRAMES.sail1, MISC_FRAMES.sail2].map((frame) =>
      createFrameTexture(miscellaneousTexture, frame),
    ),
    wood: [MISC_FRAMES.wood1, MISC_FRAMES.wood2, MISC_FRAMES.wood3, MISC_FRAMES.wood4].map(
      (frame) => createFrameTexture(miscellaneousTexture, frame),
    ),
    cannon: createFrameTexture(miscellaneousTexture, MISC_FRAMES.cannonLoose),
    dinghy: createFrameTexture(miscellaneousTexture, MISC_FRAMES.dinghy),
    crew: [MISC_FRAMES.crew1, MISC_FRAMES.crew2, MISC_FRAMES.crew3].map(
      (frame) => createFrameTexture(miscellaneousTexture, frame),
    ),
  };
  const destructionFrameTextures = [
    ...destructionTextures.hulls,
    ...destructionTextures.sails,
    ...destructionTextures.wood,
    destructionTextures.cannon,
    destructionTextures.dinghy,
    ...destructionTextures.crew,
  ];
  const islandTextures: IslandTextures = {
    base: createIslandTexture(islandSheetTexture),
    cannon: createFrameTexture(miscellaneousTexture, MISC_FRAMES.cannon),
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
  const wreckLayer = new Container();
  const effectLayer = new Container();
  const entityLayer = new Container();
  const destructionLayer = new Container();
  const projectileTrailGraphics = new Graphics();
  const projectileLayer = new Container();
  world.addChild(
    water,
    islandLayer,
    wreckLayer,
    effectLayer,
    entityLayer,
    destructionLayer,
    projectileTrailGraphics,
    projectileLayer,
  );
  application.stage.addChild(world);
  host.appendChild(application.canvas);

  for (const [index, island] of config.arena.islands.entries()) {
    islandLayer.addChild(createIslandView(island, index, islandTextures));
  }

  const shipViews = new Map<number, ShipViews>();
  const projectileViews = new Map<number, Sprite>();
  const effectViews: EffectView[] = [];
  const destructionViews: DestructionView[] = [];
  const wreckViews: WreckView[] = [];
  let createdDestructionFragmentCount = 0;
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
      const radius =
        event.kind === "player"
          ? config.player.radius
          : event.kind === "chaser"
            ? config.chaser.radius
            : config.shooter.radius;
      const destruction = createDestructionView(
        event.pos,
        event.kind,
        radius,
        destructionTextures,
        explosionTextures[event.kind],
        config,
      );
      createdDestructionFragmentCount += destruction.fragments.length;
      destructionLayer.addChild(destruction.container);
      destructionViews.push(destruction);
      if (destructionViews.length > MAX_DESTRUCTION_EFFECTS) {
        const oldest = destructionViews.shift();
        if (oldest) {
          destructionLayer.removeChild(oldest.container);
          oldest.container.destroy({ children: true });
        }
      }

      const wreck = createWreckView(event.pos, destructionTextures);
      wreckLayer.addChild(wreck.container);
      wreckViews.push(wreck);
      if (wreckViews.length > MAX_DESTRUCTION_EFFECTS) {
        const oldest = wreckViews.shift();
        if (oldest) {
          wreckLayer.removeChild(oldest.container);
          oldest.container.destroy({ children: true });
        }
      }
      return;
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
    const screenIsNarrowerThanArena =
      screen.width / screen.height <
      config.arena.width / config.arena.height;
    const centeredX = (screen.width - config.arena.width * scale) / 2;
    const followX = Math.min(
      0,
      Math.max(
        screen.width - config.arena.width * scale,
        screen.width / 2 - state.player.pos.x * scale,
      ),
    );
    world.position.set(
      screenIsNarrowerThanArena ? followX : centeredX,
      (screen.height - config.arena.height * scale) / 2,
    );

    if (!processedStates.has(state)) {
      for (const event of state.events) {
        addEffect(event);
      }
      if (
        state.status === "ended" &&
        state.endReason === "death" &&
        state.player.hp <= 0 &&
        !state.events.some(
          (event) =>
            event.type === "explosion" &&
            event.kind === "player" &&
            event.pos.x === state.player.pos.x &&
            event.pos.y === state.player.pos.y,
        )
      ) {
        addEffect({
          type: "explosion",
          pos: state.player.pos,
          kind: "player",
        });
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

    for (let index = destructionViews.length - 1; index >= 0; index -= 1) {
      const destruction = destructionViews[index];
      if (state.status !== "paused") {
        destruction.ageSec += deltaSeconds;
      }
      if (destruction.ageSec >= DESTRUCTION_EFFECT_LIFETIME_SEC) {
        destructionLayer.removeChild(destruction.container);
        destruction.container.destroy({ children: true });
        destructionViews.splice(index, 1);
        continue;
      }

      const explosionProgress = Math.min(
        1,
        destruction.ageSec / destruction.explosionDurationSec,
      );
      const explosionFrame = Math.min(
        destruction.explosionTextures.length - 1,
        Math.floor(explosionProgress * destruction.explosionTextures.length),
      );
      const explosionScale = 0.68 + explosionProgress * 0.95;
      destruction.explosion.visible =
        destruction.ageSec < destruction.explosionDurationSec;
      destruction.explosion.texture =
        destruction.explosionTextures[explosionFrame];
      destruction.explosion.width = destruction.explosionSize * explosionScale;
      destruction.explosion.height = destruction.explosionSize * explosionScale;
      destruction.explosion.alpha = 1 - explosionProgress * 0.88;

      for (const fragment of destruction.fragments) {
        const age = destruction.ageSec;
        fragment.sprite.position.set(
          fragment.offsetX + fragment.velocityX * age,
          fragment.offsetY + fragment.velocityY * age + 29 * age * age,
        );
        fragment.sprite.rotation =
          fragment.initialRotation + fragment.angularVelocity * age;
        fragment.sprite.alpha = Math.max(
          0,
          1 - Math.max(0, (age - 0.2) / (DESTRUCTION_EFFECT_LIFETIME_SEC - 0.2)),
        );
      }
    }

    for (let index = wreckViews.length - 1; index >= 0; index -= 1) {
      const wreck = wreckViews[index];
      if (state.status !== "paused") {
        wreck.ageSec += deltaSeconds;
      }
      if (wreck.ageSec >= WRECK_LIFETIME_SEC) {
        wreckLayer.removeChild(wreck.container);
        wreck.container.destroy({ children: true });
        wreckViews.splice(index, 1);
        continue;
      }

      const fadeStart = WRECK_LIFETIME_SEC - 5;
      const fadeProgress = Math.max(
        0,
        (wreck.ageSec - fadeStart) / (WRECK_LIFETIME_SEC - fadeStart),
      );
      wreck.container.position.set(
        wreck.originX + Math.sin(wreck.ageSec * 0.3) * 3,
        wreck.originY +
          Math.min(wreck.ageSec, 12) * 0.35 +
          Math.sin(wreck.ageSec * 1.4) * 2,
      );
      wreck.container.rotation = Math.sin(wreck.ageSec * 0.45) * 0.035;
      wreck.container.alpha = 1 - fadeProgress;
      wreck.crew.forEach((crew, crewIndex) => {
        const baseY = crewIndex === 0 ? -10 : crewIndex === 1 ? 1 : 23;
        crew.position.y = baseY + Math.sin(wreck.ageSec * 2 + crewIndex) * 1.2;
      });
    }

    const playerDestroyed =
      state.status === "ended" &&
      state.endReason === "death" &&
      state.player.hp <= 0;
    const visibleShips = playerDestroyed
      ? state.enemies
      : [state.player, ...state.enemies];
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

    projectileTrailGraphics.clear();
    const visibleProjectileIds = new Set(state.projectiles.map(({ id }) => id));
    for (const [id, sprite] of projectileViews) {
      if (!visibleProjectileIds.has(id)) {
        projectileLayer.removeChild(sprite);
        sprite.destroy({ texture: false, textureSource: false });
        projectileViews.delete(id);
      }
    }

    for (const projectile of state.projectiles) {
      const velocityLength = Math.hypot(projectile.vel.x, projectile.vel.y);
      if (velocityLength > 0) {
        const trailLength = projectile.radius * 4;
        const trailX =
          projectile.pos.x -
          (projectile.vel.x / velocityLength) * trailLength;
        const trailY =
          projectile.pos.y -
          (projectile.vel.y / velocityLength) * trailLength;
        const trailColor =
          projectile.owner === "player" ? 0xd4f5ff : 0xffe0cf;
        projectileTrailGraphics
          .moveTo(trailX, trailY)
          .lineTo(projectile.pos.x, projectile.pos.y)
          .stroke({
            color: trailColor,
            alpha: 0.16,
            width: projectile.radius * 0.9,
            cap: "round",
          })
          .moveTo(trailX, trailY)
          .lineTo(projectile.pos.x, projectile.pos.y)
          .stroke({
            color: 0xfff8e8,
            alpha: 0.56,
            width: Math.max(1, projectile.radius * 0.24),
            cap: "round",
          });
      }

      let sprite = projectileViews.get(projectile.id);
      if (!sprite) {
        sprite = new Sprite(cannonballTexture);
        sprite.anchor.set(0.5);
        projectileLayer.addChild(sprite);
        projectileViews.set(projectile.id, sprite);
      }
      sprite.position.set(projectile.pos.x, projectile.pos.y);
      sprite.rotation = Math.atan2(projectile.vel.y, projectile.vel.x);
      sprite.width = projectile.radius * 2;
      sprite.height = projectile.radius * 2;
    }

  };

  return {
    application,
    draw,
    getCameraTransform: () => ({
      x: world.position.x,
      y: world.position.y,
      scale: world.scale.x,
    }),
    getCreatedDestructionFragmentCount: () =>
      createdDestructionFragmentCount,
    getRenderedShipIds: () => [...shipViews.keys()],
    getWreckCount: () => wreckViews.length,
    destroy(): void {
      application.destroy({ removeView: true }, { children: true });
      Object.values(damagedTextureByKind).forEach((texture) =>
        texture.destroy(true),
      );
      islandTextures.base.destroy(true);
      islandTextures.cannon.destroy(false);
      destructionFrameTextures.forEach((texture) => texture.destroy(false));
      shipViews.clear();
      projectileViews.clear();
    },
  };
}
