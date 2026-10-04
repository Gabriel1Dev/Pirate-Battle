import { expect, test, type Page } from "@playwright/test";

interface BrowserGameState {
  readonly status: string;
  readonly endReason?: string;
  readonly elapsedSec: number;
  readonly score: number;
  readonly config: {
    readonly step: { readonly fixedStepSec: number };
    readonly match: { readonly durationSec: number };
    readonly arena: {
      readonly islands: readonly {
        readonly x: number;
        readonly y: number;
        readonly radius: number;
      }[];
    };
    readonly player: {
      readonly speed: number;
      readonly turnSpeed: number;
      readonly front: { readonly cooldownSec: number };
      readonly broadside: {
        readonly cooldownSec: number;
        readonly projectileCount: number;
      };
    };
  };
  readonly player: {
    readonly pos: { readonly x: number; readonly y: number };
    readonly angle: number;
    readonly radius: number;
    readonly hp: number;
  };
  readonly enemies: readonly {
    readonly kind: string;
    readonly pos: { readonly x: number; readonly y: number };
    readonly hp: number;
  }[];
  readonly stats: {
    readonly shotsFired: number;
    readonly enemiesSpawned: number;
    readonly enemiesDestroyed: number;
    readonly damageTaken: number;
  };
}

declare global {
  interface Window {
    __game?: {
      getState(): BrowserGameState | null;
      getCameraTransform(): {
        readonly x: number;
        readonly y: number;
        readonly scale: number;
      } | null;
      getCreatedDestructionFragmentCount(): number;
      getRenderedShipIds(): readonly number[];
      getWreckCount(): number;
      setInput(input: {
        forward?: boolean;
        turnLeft?: boolean;
        turnRight?: boolean;
        fireFront?: boolean;
        fireLeft?: boolean;
        fireRight?: boolean;
      }): void;
      advanceBy(seconds: number): void;
      reset(seed: number): void;
      useRealtimeClock(): void;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("e2e-initialized") !== "true") {
      window.localStorage.clear();
      window.sessionStorage.setItem("e2e-initialized", "true");
    }
  });
  await page.goto("/");
});

async function openNetworkScenario(
  page: Page,
  scenario: string,
): Promise<void> {
  await page.goto(`/?scenario=${encodeURIComponent(scenario)}`);
}

async function setNetworkScenario(page: Page, scenario: string): Promise<void> {
  await page.evaluate((nextScenario) => {
    window.localStorage.setItem(
      "pirate-battle.network-scenario.v1",
      nextScenario,
    );
    const url = new URL(window.location.href);
    url.searchParams.set("scenario", nextScenario);
    window.history.replaceState(null, "", url);
  }, scenario);
}

test("waits for the mock API before showing the main menu", async ({
  page,
}) => {
  await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();

  const apiResponses = await page.evaluate(async () => {
    const healthResponse = await fetch("/api/health");
    const health = (await healthResponse.json()) as { status?: string };
    const match = {
      matchId: "startup-readiness-match",
      playerId: "local-player",
      completedAt: new Date().toISOString(),
      score: 0,
      durationSec: 1,
      endReason: "time",
      config: {},
    };
    const submit = (): Promise<Response> =>
      fetch("/api/matches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": match.matchId,
        },
        body: JSON.stringify(match),
      });
    const firstSubmission = await submit();
    const duplicateSubmission = await submit();

    return {
      healthStatus: healthResponse.status,
      health,
      firstSubmissionStatus: firstSubmission.status,
      duplicateSubmissionStatus: duplicateSubmission.status,
    };
  });

  expect(apiResponses).toEqual({
    healthStatus: 200,
    health: { status: "ok" },
    firstSubmissionStatus: 201,
    duplicateSubmissionStatus: 200,
  });
});

test("saves validated match options across a reload", async ({ page }) => {
  await page.getByRole("button", { name: "OPTIONS" }).click();

  const durationInput = page.getByRole("spinbutton", {
    name: "Game session time",
  });
  const spawnInput = page.getByRole("spinbutton", {
    name: "Enemy spawn time",
  });
  await durationInput.fill("120");
  await spawnInput.fill("4");
  await page.getByRole("button", { name: "MAIN MENU" }).click();

  await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "OPTIONS" }).click();

  await expect(
    page.getByRole("spinbutton", { name: "Game session time" }),
  ).toHaveValue("120");
  await expect(
    page.getByRole("spinbutton", { name: "Enemy spawn time" }),
  ).toHaveValue("4");
});

test("confirms that in-match options apply to the next match", async ({
  page,
}) => {
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);
  await page.getByRole("button", { name: "Pause battle" }).click();
  await expect(page.getByRole("heading", { name: "PAUSED" })).toBeVisible();
  await page.getByRole("button", { name: "OPTIONS" }).click();
  await page.getByRole("spinbutton", { name: "Game session time" }).fill("120");
  await page.getByRole("button", { name: "SAVE OPTIONS" }).click();

  await expect(page.getByRole("heading", { name: "NEXT VOYAGE" })).toBeVisible();
  await expect(
    page.getByText(/These settings will take effect in your next match/),
  ).toBeVisible();
  await page.getByRole("button", { name: "CONTINUE PLAYING" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__game?.getState()?.status))
    .toBe("running");
  expect(
    await page.evaluate(
      () => window.__game?.getState()?.config.match.durationSec,
    ),
  ).toBe(90);

  await page.getByRole("button", { name: "Pause battle" }).click();
  await page.getByRole("button", { name: "OPTIONS" }).click();
  await page.getByRole("spinbutton", { name: "Game session time" }).fill("121");
  await page.getByRole("button", { name: "SAVE OPTIONS" }).click();
  await page.getByRole("button", { name: "MAIN MENU", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();

  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(
    () => window.__game?.getState()?.config.match.durationSec === 121,
  );
});

test("does not show the game when mock API startup fails", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Startup failure is verified in the desktop profile.");
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  });
  await page.goto("about:blank");
  await page.addInitScript(() => {
    ServiceWorkerContainer.prototype.register = async function (
      scriptURL,
      options,
    ) {
      if (String(scriptURL).includes("mockServiceWorker")) {
        throw new Error("MSW is unavailable for this test.");
      }
      throw new Error(`Unexpected service worker registration: ${String(options)}`);
    };
  });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Unable to start Pirate Battle" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "PLAY" })).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);

  await page.getByRole("button", { name: "Retry" }).click();
  await expect(
    page.getByRole("heading", { name: "Unable to start Pirate Battle" }),
  ).toBeVisible();
});

test("advances the seeded simulation, fires, and spawns both enemy types", async ({
  page,
}) => {
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);

  const initialPosition = await page.evaluate(
    () => window.__game?.getState()?.player.pos,
  );
  await page.evaluate(() => {
    window.__game?.reset(19);
    window.__game?.setInput({
      forward: true,
      fireFront: true,
      fireLeft: true,
    });
    window.__game?.advanceBy(18);
    window.__game?.setInput({});
  });

  const state = await page.evaluate(() => window.__game?.getState() ?? null);
  expect(state).not.toBeNull();
  expect(state?.stats.shotsFired).toBeGreaterThan(1);
  expect(state?.stats.enemiesSpawned).toBeGreaterThan(0);
  expect(state?.enemies.some((enemy) => enemy.kind === "chaser")).toBe(true);
  expect(state?.enemies.some((enemy) => enemy.kind === "shooter")).toBe(true);
  expect(state?.player.pos.x).toBeGreaterThan(initialPosition?.x ?? 0);
});

test("deals combat damage and awards exactly one point per destroyed enemy", async ({
  page,
}) => {
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);

  const result = await page.evaluate(() => {
    const hook = window.__game;
    if (!hook) {
      throw new Error("The deterministic game test hook is unavailable.");
    }

    hook.reset(19);
    hook.setInput({
      fireFront: true,
      fireLeft: true,
      fireRight: true,
    });
    hook.advanceBy(2.5);
    const cooldownState = hook.getState();
    if (!cooldownState) {
      throw new Error("The weapon cooldown state was lost.");
    }
    const cooldownShots = cooldownState.stats.shotsFired;

    hook.reset(19);
    const turnDuration =
      Math.PI / (2 * (hook.getState()?.config.player.turnSpeed ?? 1));
    hook.setInput({ turnLeft: true });
    hook.advanceBy(turnDuration);
    hook.setInput({ forward: true });
    hook.advanceBy(1.55);
    hook.setInput({ turnRight: true });
    hook.advanceBy(turnDuration);
    for (let elapsed = 0; elapsed < 24; elapsed += 0.25) {
      const state = hook.getState();
      if (!state || state.status !== "running") {
        break;
      }

      const enemy = state.enemies[0];
      if (!enemy) {
        hook.setInput({
          forward: true,
          turnRight: true,
          fireFront: true,
          fireLeft: true,
          fireRight: true,
        });
      } else {
        const targetAngle = Math.atan2(
          enemy.pos.y - state.player.pos.y,
          enemy.pos.x - state.player.pos.x,
        );
        const angleDifference = Math.atan2(
          Math.sin(targetAngle - state.player.angle),
          Math.cos(targetAngle - state.player.angle),
        );
        hook.setInput({
          forward: true,
          turnLeft: angleDifference < 0,
          turnRight: angleDifference >= 0,
          fireFront: true,
          fireLeft: true,
          fireRight: true,
        });
      }
      hook.advanceBy(0.25);
    }
    hook.setInput({});

    const state = hook.getState();
    if (!state) {
      throw new Error("The deterministic game state was lost.");
    }
    const pursuitDamage = state.stats.damageTaken;
    hook.reset(19);
    hook.setInput({
      fireFront: true,
      fireLeft: true,
      fireRight: true,
    });
    hook.advanceBy(24);
    const stationaryState = hook.getState();
    if (!stationaryState) {
      throw new Error("The stationary combat state was lost.");
    }
    return {
      cooldownShots,
      score: state.score,
      destroyed: state.stats.enemiesDestroyed,
      wrecks: hook.getWreckCount(),
      damageTaken: Math.max(pursuitDamage, stationaryState.stats.damageTaken),
      shotsFired: Math.max(
        state.stats.shotsFired,
        stationaryState.stats.shotsFired,
      ),
    };
  });

  expect(result.cooldownShots).toBeGreaterThan(0);
  expect(result.cooldownShots).toBeLessThanOrEqual(30);
  expect(result.shotsFired).toBeGreaterThan(0);
  expect(result.damageTaken).toBeGreaterThan(0);
  expect(result.destroyed).toBeGreaterThan(0);
  expect(result.wrecks).toBeGreaterThan(0);
  expect(result.score).toBe(result.destroyed);
});

test("fires broadside projectiles in sequence instead of simultaneously", async ({
  page,
}) => {
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);

  const shotTimes = await page.evaluate(() => {
    const hook = window.__game;
    if (!hook) {
      throw new Error("The deterministic game test hook is unavailable.");
    }

    hook.reset(29);
    hook.setInput({ fireLeft: true });
    const times: number[] = [];
    let previousShotCount = 0;
    for (let elapsed = 0; elapsed < 0.25; elapsed += 0.025) {
      hook.advanceBy(0.025);
      const state = hook.getState();
      if (!state) {
        throw new Error("The deterministic game state was lost.");
      }
      if (state.stats.shotsFired > previousShotCount) {
        times.push(state.elapsedSec);
        previousShotCount = state.stats.shotsFired;
      }
    }
    hook.setInput({});
    return times;
  });

  expect(shotTimes).toHaveLength(3);
  expect(shotTimes[1] - shotTimes[0]).toBeGreaterThanOrEqual(0.05);
  expect(shotTimes[2] - shotTimes[1]).toBeGreaterThanOrEqual(0.05);
  expect(shotTimes[1] - shotTimes[0]).toBeLessThan(0.12);
  expect(shotTimes[2] - shotTimes[1]).toBeLessThan(0.12);
});

test("stops the player at island and arena boundaries", async ({ page }) => {
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);
  await page.evaluate(() => {
    window.__game?.reset(321);
    const state = window.__game?.getState();
    const turnDuration = Math.PI / (state?.config.player.turnSpeed ?? 1);
    window.__game?.setInput({ turnRight: true });
    window.__game?.advanceBy(turnDuration);
    window.__game?.setInput({ forward: true });
    window.__game?.advanceBy(
      (state?.player.pos.x ?? 0) / (state?.config.player.speed ?? 1) + 1,
    );
    window.__game?.setInput({});
  });

  const boundaryState = await page.evaluate(() => window.__game?.getState());
  expect(boundaryState?.player.pos.x).toBeGreaterThanOrEqual(
    boundaryState?.player.radius ?? 0,
  );
  expect(boundaryState?.player.pos.x).toBeLessThan(
    (boundaryState?.player.radius ?? 0) +
      (boundaryState?.config.player.speed ?? 0) *
      (boundaryState?.config.step.fixedStepSec ?? 0),
  );

  await page.evaluate(() => {
    window.__game?.reset(321);
    window.__game?.setInput({ forward: true });
    window.__game?.advanceBy(2);
    window.__game?.setInput({});
  });
  const islandBlockedState = await page.evaluate(
    () => window.__game?.getState(),
  );
  const blockingIsland = islandBlockedState?.config.arena.islands.find(
    (island) => island.y === islandBlockedState.player.pos.y,
  );
  expect(blockingIsland).toBeDefined();
  expect(islandBlockedState?.player.pos.x).toBeLessThanOrEqual(
    (blockingIsland?.x ?? 0) -
      (blockingIsland?.radius ?? 0) -
      (islandBlockedState?.player.radius ?? 0),
  );
  expect(islandBlockedState?.player.pos.x).toBeGreaterThan(
    islandBlockedState?.player.radius ?? 0,
  );
  const islandDistance = Math.hypot(
    (blockingIsland?.x ?? 0) - (islandBlockedState?.player.pos.x ?? 0),
    (blockingIsland?.y ?? 0) - (islandBlockedState?.player.pos.y ?? 0),
  );
  expect(islandDistance).toBeGreaterThan(
    (blockingIsland?.radius ?? 0) +
      (islandBlockedState?.player.radius ?? 0),
  );
  expect(islandDistance).toBeLessThanOrEqual(
    (blockingIsland?.radius ?? 0) * 1.45 +
      (islandBlockedState?.player.radius ?? 0),
  );

  const positionAtIsland = islandBlockedState?.player.pos;
  await page.evaluate(() => window.__game?.advanceBy(0.5));
  const stoppedAtIsland = await page.evaluate(() => window.__game?.getState());
  expect(stoppedAtIsland?.player.pos).toEqual(positionAtIsland);
});

test("freezes the simulation during pause and restarts with fresh state", async ({
  page,
}) => {
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);
  await page.evaluate(() => {
    window.__game?.reset(123);
    window.__game?.advanceBy(2);
  });
  await page.getByRole("button", { name: "Pause battle" }).click();

  const elapsedBeforePause = await page.evaluate(
    () => window.__game?.getState()?.elapsedSec,
  );
  await page.evaluate(() => window.__game?.advanceBy(5));
  await expect.poll(
    () => page.evaluate(() => window.__game?.getState()?.elapsedSec),
  ).toBe(elapsedBeforePause);

  await page.getByRole("button", { name: "RESUME", exact: true }).click();
  await page.getByRole("button", { name: "Main menu" }).click();
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);
  await page.evaluate(() => window.__game?.reset(124));
  const restarted = await page.evaluate(() => window.__game?.getState());
  expect(restarted?.score).toBe(0);
  expect(restarted?.enemies).toHaveLength(0);
});

test("returns to the menu when the game window loses focus", async ({ page }) => {
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);
  await page.evaluate(() => {
    window.__game?.reset(456);
    window.__game?.setInput({ forward: true });
    window.dispatchEvent(new Event("blur"));
  });

  await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem("pirate-battle.matches.v1"),
    ),
  ).toBeNull();
});

test("returns to the menu when the game page becomes hidden", async ({
  page,
}) => {
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("ends and saves the match when the player is destroyed", async ({
  page,
}) => {
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);
  await page.evaluate(() => {
    window.__game?.reset(19);
    const duration = window.__game?.getState()?.config.match.durationSec ?? 0;
    window.__game?.advanceBy(duration);
  });

  await expect(
    page.getByRole("heading", { name: "VOYAGE COMPLETE" }),
  ).toBeVisible();
  const endedState = await page.evaluate(() => window.__game?.getState());
  expect(endedState?.status).toBe("ended");
  expect(endedState?.endReason).toBe("death");
  expect(endedState?.player.hp).toBe(0);
  expect(
    await page.evaluate(
      () => window.__game?.getCreatedDestructionFragmentCount() ?? 0,
    ),
  ).toBeGreaterThanOrEqual(7);
  expect(
    await page.evaluate(() => window.__game?.getRenderedShipIds()),
  ).not.toContain(1);
  expect(await page.evaluate(() => window.__game?.getWreckCount())).toBe(1);
  expect(endedState?.elapsedSec).toBeLessThan(
    endedState?.config.match.durationSec ?? 0,
  );

  await page.evaluate(() => window.__game?.advanceBy(10));
  const frozenState = await page.evaluate(() => window.__game?.getState());
  expect(frozenState?.elapsedSec).toBe(endedState?.elapsedSec);
  expect(frozenState?.score).toBe(endedState?.score);

  const storedEndReason = await page.evaluate(() => {
    const stored = window.localStorage.getItem("pirate-battle.matches.v1");
    if (!stored) {
      return null;
    }
    return (
      JSON.parse(stored) as {
        readonly matches: readonly { readonly endReason: string }[];
      }
    ).matches[0]?.endReason;
  });
  expect(storedEndReason).toBe("death");
});

test("does not submit an abandoned match and persists a completed result after refresh", async ({
  page,
}) => {
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);
  await page.getByRole("button", { name: "Main menu" }).click();

  const abandonedRecords = await page.evaluate(
    () => window.localStorage.getItem("pirate-battle.matches.v1"),
  );
  expect(abandonedRecords).toBeNull();

  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);
  await page.evaluate(() => window.__game?.advanceBy(100));
  await expect(
    page.getByRole("heading", { name: "VOYAGE COMPLETE" }),
  ).toBeVisible();
  await page.reload();

  await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
  const savedResult = await page.evaluate(() => {
    const stored = window.localStorage.getItem("pirate-battle.matches.v1");
    if (!stored) {
      return null;
    }
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("matches" in parsed) ||
      !Array.isArray(parsed.matches)
    ) {
      return null;
    }
    return parsed.matches[0] ?? null;
  });
  expect(savedResult).not.toBeNull();
});

test("ends a surviving match when its configured timer expires", async ({
  page,
}) => {
  await page.getByRole("button", { name: "OPTIONS" }).click();
  await page.getByRole("spinbutton", { name: "Game session time" }).fill("60");
  await page.getByRole("spinbutton", { name: "Enemy spawn time" }).fill("10");
  await page.getByRole("button", { name: "MAIN MENU" }).click();
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);

  const completedState = await page.evaluate(() => {
    const hook = window.__game;
    if (!hook) {
      throw new Error("The deterministic game test hook is unavailable.");
    }
    hook.reset(77);
    for (let elapsed = 0; elapsed < 62; elapsed += 0.5) {
      const currentState = hook.getState();
      if (!currentState || currentState.status !== "running") {
        break;
      }
      const turnRight = Math.floor(elapsed / 2) % 2 === 0;
      hook.setInput({
        forward: true,
        turnLeft: !turnRight,
        turnRight,
        fireFront: true,
        fireLeft: true,
        fireRight: true,
      });
      hook.advanceBy(0.5);
    }
    hook.setInput({});
    return hook.getState();
  });

  expect(completedState?.status).toBe("ended");
  expect(completedState?.endReason).toBe("time");
  expect(completedState?.elapsedSec).toBe(60);
  await expect(
    page.getByRole("heading", { name: "VOYAGE COMPLETE" }),
  ).toBeVisible();
  const savedEndReason = await page.evaluate(() => {
    const stored = window.localStorage.getItem("pirate-battle.matches.v1");
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored) as {
      readonly matches: readonly { readonly endReason: string }[];
    };
    return parsed.matches[0]?.endReason ?? null;
  });
  expect(savedEndReason).toBe("time");
});

test("drives movement and firing with mobile touch controls", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Touch controls are only visible in the mobile profile.");
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);

  const initialPosition = await page.evaluate(
    () => window.__game?.getState()?.player.pos,
  );
  const moveButton = page.getByRole("button", { name: "Move forward" });
  await moveButton.hover();
  await page.mouse.down();
  await page.evaluate(() => window.__game?.advanceBy(1));
  await page.mouse.up();

  const fireButton = page.getByRole("button", { name: "Fire front" });
  await fireButton.hover();
  await page.mouse.down();
  await page.evaluate(() => window.__game?.advanceBy(0.5));
  await page.mouse.up();

  const state = await page.evaluate(() => window.__game?.getState());
  expect(state?.player.pos.x).toBeGreaterThan(initialPosition?.x ?? 0);
  expect(state?.stats.shotsFired).toBeGreaterThan(0);
});

test("follows the player with the camera in the mobile viewport", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "The following camera is specific to narrow viewports.");
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(
    () => window.__game?.getCameraTransform() !== null,
  );

  const initialCamera = await page.evaluate(
    () => window.__game?.getCameraTransform() ?? null,
  );
  await page.evaluate(() => {
    window.__game?.setInput({ forward: true });
    window.__game?.advanceBy(1);
    window.__game?.setInput({});
  });

  const result = await page.evaluate(() => {
    const camera = window.__game?.getCameraTransform();
    const player = window.__game?.getState()?.player;
    const canvas = document.querySelector("canvas");
    if (!camera || !player || !canvas) {
      throw new Error("The mobile camera state is unavailable.");
    }

    return {
      camera,
      playerScreenX: camera.x + player.pos.x * camera.scale,
      canvasWidth: canvas.getBoundingClientRect().width,
    };
  });

  expect(result.camera.x).toBeLessThan(initialCamera?.x ?? 0);
  expect(result.playerScreenX).toBeCloseTo(result.canvasWidth / 2, 0);
});

test("keeps failed match uploads pending and retries them without duplicates", async ({
  page,
}) => {
  await openNetworkScenario(page, "offline-on-finish");
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);
  await page.evaluate(() => window.__game?.advanceBy(100));
  await expect(page.getByRole("heading", { name: "VOYAGE COMPLETE" })).toBeVisible();

  const pendingMatch = await page.evaluate(() => {
    const stored = window.localStorage.getItem("pirate-battle.matches.v1");
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored) as {
      readonly matches: readonly {
        readonly matchId: string;
        readonly submissionStatus: string;
      }[];
    };
    return parsed.matches[0] ?? null;
  });
  expect(pendingMatch?.submissionStatus).toBe("pending");

  await page.getByRole("button", { name: "MAIN MENU", exact: true }).click();
  await expect(page.getByRole("button", { name: /Retry upload/ })).toBeVisible();
  await page.waitForTimeout(1_500);
  await expect(
    page.getByRole("button", { name: /Retry upload/ }),
  ).toBeVisible();
  await setNetworkScenario(page, "success");
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const stored = window.localStorage.getItem(
            "pirate-battle.matches.v1",
          );
          if (!stored) {
            return null;
          }
          const parsed = JSON.parse(stored) as {
            readonly matches: readonly {
              readonly matchId: string;
              readonly submissionStatus: string;
            }[];
          };
          return parsed.matches[0]?.submissionStatus;
        }),
      { timeout: 15_000 },
    )
    .toBe("confirmed");

  const matchCount = await page.evaluate((matchId) => {
    const stored = window.localStorage.getItem("pirate-battle.matches.v1");
    return stored
      ? (
          JSON.parse(stored) as {
            readonly matches: readonly { readonly matchId: string }[];
          }
        ).matches.filter((match) => match.matchId === matchId).length
      : 0;
  }, pendingMatch?.matchId ?? "");
  expect(matchCount).toBe(1);

  await page.getByRole("button", { name: "Match History" }).click();
  const historyEntry = page.locator(".history-rows li");
  await expect(historyEntry).toBeVisible();
  await expect(historyEntry.locator(".data-points")).toHaveText("0");
  await expect(historyEntry.locator(".data-duration")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "MAIN MENU", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await openNetworkScenario(page, "history-fail");
  await page.getByRole("button", { name: "Match History" }).click();
  await expect(
    page.getByText("Match history could not be loaded."),
  ).toBeVisible({ timeout: 15_000 });
  await openNetworkScenario(page, "empty");
  await page.getByRole("button", { name: "Match History" }).click();
  await expect(
    page.getByText("No completed matches in your history."),
  ).toBeVisible({ timeout: 15_000 });
});

test("shows paginated ranking and selectable empty and failure scenarios", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Ranking" }).click();
  await expect(page.getByText("Captain Rowan")).toBeVisible();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();

  await openNetworkScenario(page, "empty");
  await page.getByRole("button", { name: "Ranking" }).click();
  await expect(page.getByText("No ranking entries yet.")).toBeVisible();
  await openNetworkScenario(page, "ranking-fail");
  await page.getByRole("button", { name: "Ranking" }).click();
  await expect(
    page.getByText("Ranking could not be loaded."),
  ).toBeVisible({ timeout: 15_000 });
  await openNetworkScenario(page, "success");
  await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
});

test("keeps network demo controls out of the main menu", async ({
  page,
}) => {
  await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
  await expect(page.getByText(/Network demo/i)).toHaveCount(0);
  await expect(page.getByLabel("Scenario")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset mock data" })).toHaveCount(
    0,
  );
  const buttonBackgrounds = await page
    .locator(".home-card .menu-button, .home-card .menu-data-tabs button")
    .evaluateAll((buttons) =>
      buttons.map((button) => getComputedStyle(button).backgroundImage),
    );
  expect(buttonBackgrounds).toEqual([
    expect.stringContaining("button_primary_normal.png"),
    expect.stringContaining("button_secondary_normal.png"),
    expect.stringContaining("button_secondary_normal.png"),
    expect.stringContaining("button_secondary_normal.png"),
  ]);

  await page.getByRole("button", { name: "PLAY" }).hover();
  await expect
    .poll(() =>
      page
        .getByRole("button", { name: "PLAY" })
        .evaluate((button) => getComputedStyle(button).backgroundImage),
    )
    .toContain("button_primary_hover.png");

  for (const name of ["OPTIONS", "Ranking", "Match History"]) {
    const button = page.getByRole("button", { name });
    await button.hover();
    await expect
      .poll(() =>
        button.evaluate((element) => ({
          image: getComputedStyle(element).backgroundImage,
          filter: getComputedStyle(element).filter,
        })),
      )
      .toEqual({
        image: expect.stringContaining("button_secondary_normal.png"),
        filter: "brightness(1.2)",
      });
  }

  await page.goto("/?scenario=empty");
  await page.getByRole("button", { name: "Ranking" }).click();
  await expect(page.getByText("No ranking entries yet.")).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Ranking" }).click();
  await expect(page.getByText("Captain Rowan")).toBeVisible();
});

test("keeps the newest ranking page selected when an older response arrives late", async ({
  page,
}) => {
  await openNetworkScenario(page, "variable-latency");
  await page.getByRole("button", { name: "Ranking" }).click();
  await expect(page.getByText("Captain Rowan")).toBeVisible();

  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await page.waitForTimeout(1_300);

  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByText("Sable")).toBeVisible();
  await expect(page.getByText("Captain Rowan")).toHaveCount(0);
});

test("upserts a match once when the server saves before timing out", async ({
  page,
}) => {
  await openNetworkScenario(page, "timeout-after-save");
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);
  await page.evaluate(() => window.__game?.advanceBy(100));
  await expect(page.getByRole("heading", { name: "VOYAGE COMPLETE" })).toBeVisible();

  await page.getByRole("button", { name: "MAIN MENU", exact: true }).click();
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const stored = window.localStorage.getItem("pirate-battle.matches.v1");
          if (!stored) {
            return null;
          }
          const parsed = JSON.parse(stored) as {
            readonly matches: readonly { readonly submissionStatus: string }[];
          };
          return parsed.matches[0]?.submissionStatus ?? null;
        }),
      { timeout: 15_000 },
    )
    .toBe("confirmed");
  await expect(page.getByRole("status")).toHaveCount(0);

  const persistedMatches = await page.evaluate(() => {
    const stored = window.localStorage.getItem("pirate-battle.matches.v1");
    const mockStored = window.localStorage.getItem("pirate-battle.mock-matches.v1");
    if (!stored || !mockStored) {
      return null;
    }
    const localMatches = (
      JSON.parse(stored) as {
        readonly matches: readonly {
          readonly matchId: string;
          readonly submissionStatus: string;
        }[];
      }
    ).matches;
    const remoteMatches = JSON.parse(mockStored) as readonly {
      readonly matchId: string;
    }[];
    return { localMatches, remoteMatches };
  });

  expect(persistedMatches?.localMatches).toHaveLength(1);
  expect(persistedMatches?.localMatches[0]?.submissionStatus).toBe("confirmed");
  expect(persistedMatches?.remoteMatches).toHaveLength(1);
  expect(persistedMatches?.remoteMatches[0]?.matchId).toBe(
    persistedMatches?.localMatches[0]?.matchId,
  );
});
