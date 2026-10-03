import { expect, test } from "@playwright/test";

interface PerformanceGameState {
  readonly status: string;
  readonly elapsedSec: number;
  readonly enemies: readonly unknown[];
  readonly projectiles: readonly unknown[];
}

declare global {
  interface Window {
    __game?: {
      getState(): PerformanceGameState | null;
      setInput(input: {
        forward?: boolean;
        turnLeft?: boolean;
        turnRight?: boolean;
        fireFront?: boolean;
        fireLeft?: boolean;
        fireRight?: boolean;
      }): void;
      advanceBy(seconds: number): void;
      useRealtimeClock(): void;
    };
  }
}

test("profiles a three-minute match and five game lifecycle cycles", async ({
  page,
  isMobile,
  browser,
}) => {
  test.skip(isMobile, "Profiling evidence uses the desktop 1280x720 viewport.");

  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("profile-initialized") !== "true") {
      window.localStorage.clear();
      window.sessionStorage.setItem("profile-initialized", "true");
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "OPTIONS" }).click();
  await page.getByRole("spinbutton", { name: "Game session time" }).fill("180");
  await page.getByRole("spinbutton", { name: "Enemy spawn time" }).fill("10");
  await page.getByRole("button", { name: "MAIN MENU" }).click();
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);

  const frameIntervalsMs = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const frameTimes: number[] = [];
        let previousTime: number | null = null;
        const startedAt = performance.now();
        const sampleFrame = (time: number): void => {
          if (previousTime !== null) {
            frameTimes.push(time - previousTime);
          }
          previousTime = time;
          if (time - startedAt >= 5000) {
            resolve(frameTimes);
            return;
          }
          requestAnimationFrame(sampleFrame);
        };
        requestAnimationFrame(sampleFrame);
      }),
  );
  const sortedIntervals = [...frameIntervalsMs].sort((left, right) => left - right);
  const fps = frameIntervalsMs.length / 5;
  const p95FrameMs =
    sortedIntervals[Math.min(
      sortedIntervals.length - 1,
      Math.ceil(sortedIntervals.length * 0.95) - 1,
    )] ?? 0;
  const webglRenderer = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const gl =
      canvas?.getContext("webgl2") ?? canvas?.getContext("webgl") ?? null;
    if (!gl) {
      return null;
    }
    const extension = gl.getExtension("WEBGL_debug_renderer_info");
    return extension
      ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
  });

  const simulationMetrics = await page.evaluate(() => {
    const game = window.__game;
    if (!game) {
      throw new Error("The deterministic game test hook is unavailable.");
    }

    let maximumEnemies = 0;
    let maximumProjectiles = 0;
    let maximumEntities = 0;
    for (let elapsed = 0; elapsed < 180; elapsed += 0.5) {
      const state = game.getState();
      if (!state || state.status !== "running") {
        break;
      }
      const turnRight = Math.floor(elapsed / 2) % 2 === 0;
      game.setInput({
        forward: true,
        turnLeft: !turnRight,
        turnRight,
        fireFront: true,
        fireLeft: true,
        fireRight: true,
      });
      game.advanceBy(0.5);

      const nextState = game.getState();
      if (!nextState) {
        throw new Error("The deterministic game state was lost.");
      }
      maximumEnemies = Math.max(maximumEnemies, nextState.enemies.length);
      maximumProjectiles = Math.max(
        maximumProjectiles,
        nextState.projectiles.length,
      );
      maximumEntities = Math.max(
        maximumEntities,
        1 + nextState.enemies.length + nextState.projectiles.length,
      );
    }
    game.setInput({});

    const finalState = game.getState();
    if (!finalState) {
      throw new Error("The deterministic game state was lost.");
    }
    return {
      elapsedSec: finalState.elapsedSec,
      endReason: finalState.endReason ?? null,
      maximumEnemies,
      maximumProjectiles,
      maximumEntities,
    };
  });
  expect(simulationMetrics.elapsedSec).toBe(180);

  const heapSamplesMb: number[] = [];
  await page.getByRole("button", { name: "MAIN MENU", exact: true }).click();
  for (let cycle = 0; cycle < 5; cycle += 1) {
    await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
    await page.getByRole("button", { name: "PLAY" }).click();
    await expect(page.locator("canvas")).toBeVisible();
    await page.waitForFunction(() => window.__game?.getState() !== null);
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Main menu" }).click();
    await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
    const usedHeapBytes = await page.evaluate(() => {
      const memory = (
        performance as Performance & {
          readonly memory?: { readonly usedJSHeapSize: number };
        }
      ).memory;
      return memory?.usedJSHeapSize ?? null;
    });
    if (usedHeapBytes !== null) {
      heapSamplesMb.push(usedHeapBytes / 1024 / 1024);
    }
  }

  const profile = {
    browser: browser.version(),
    viewport: page.viewportSize(),
    webglRenderer,
    fps,
    p95FrameMs,
    simulatedMatch: simulationMetrics,
    heapAfterCyclesMb: heapSamplesMb,
  };
  console.info(`PERFORMANCE_PROFILE ${JSON.stringify(profile)}`);
});
