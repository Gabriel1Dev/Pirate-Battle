import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  type Texture,
} from "pixi.js";
import type { GameConfig } from "../config";
import type { GameState, Ship } from "../sim/types";

const SHIP_TEXTURE_PATHS = {
  player: "/assets/png/default/ships/ship_1.png",
  chaser: "/assets/png/default/ships/ship_5.png",
  shooter: "/assets/png/default/ships/ship_10.png",
} as const;

const WATER_COLOR = 0x15536b;
const ISLAND_COLOR = 0x74945a;
const ISLAND_EDGE_COLOR = 0xc9bd85;
const PROJECTILE_COLORS = {
  player: 0xffdf77,
  enemy: 0xff725e,
} as const;

interface ShipViews {
  readonly sprite: Sprite;
  readonly healthBar: Graphics;
}

export interface GameRenderer {
  readonly application: Application;
  draw(state: GameState): void;
  destroy(): void;
}

function createHealthBar(): Graphics {
  return new Graphics();
}

function drawHealthBar(graphics: Graphics, ship: Ship): void {
  const width = ship.radius * 2;
  const height = Math.max(4, ship.radius * 0.2);
  const ratio =
    ship.maxHp > 0 ? Math.max(0, Math.min(1, ship.hp / ship.maxHp)) : 0;

  graphics.clear();
  graphics.roundRect(-width / 2, 0, width, height, height / 2).fill(0x182b30);
  graphics
    .roundRect(-width / 2, 0, width * ratio, height, height / 2)
    .fill(ratio > 0.5 ? 0x7ddd92 : ratio > 0.25 ? 0xf3c969 : 0xf07865);
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
  const textures = await Promise.all(
    Object.values(SHIP_TEXTURE_PATHS).map((path) => Assets.load<Texture>(path)),
  );
  const textureByKind = {
    player: textures[0],
    chaser: textures[1],
    shooter: textures[2],
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
  const arenaGraphics = new Graphics();
  const entityLayer = new Container();
  const projectileGraphics = new Graphics();
  world.addChild(arenaGraphics, entityLayer, projectileGraphics);
  application.stage.addChild(world);
  host.appendChild(application.canvas);

  arenaGraphics.rect(0, 0, config.arena.width, config.arena.height).fill({
    color: WATER_COLOR,
  });
  for (const island of config.arena.islands) {
    arenaGraphics
      .circle(island.x, island.y, island.radius)
      .fill({ color: ISLAND_COLOR })
      .stroke({ color: ISLAND_EDGE_COLOR, width: 7 });
    arenaGraphics
      .circle(island.x, island.y, island.radius * 0.72)
      .stroke({ color: 0x91a966, width: 3, alpha: 0.7 });
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
        entityLayer.removeChild(view.sprite, view.healthBar);
        view.sprite.destroy();
        view.healthBar.destroy();
        shipViews.delete(id);
      }
    }

    for (const ship of visibleShips) {
      let view = shipViews.get(ship.id);
      if (!view) {
        const sprite = new Sprite(textureByKind[ship.kind]);
        sprite.anchor.set(0.5);
        const healthBar = createHealthBar();
        view = { sprite, healthBar };
        shipViews.set(ship.id, view);
        entityLayer.addChild(sprite, healthBar);
      }

      view.sprite.position.set(ship.pos.x, ship.pos.y);
      view.sprite.width = ship.radius * 2;
      view.sprite.height = ship.radius * 2;
      view.sprite.rotation = ship.angle + Math.PI / 2;
      view.sprite.tint = shipDamageTint(ship, config);
      view.healthBar.position.set(ship.pos.x, ship.pos.y - ship.radius - 9);
      drawHealthBar(view.healthBar, ship);
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
