import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("e2e-initialized") !== "true") {
      window.localStorage.clear();
      window.sessionStorage.setItem("e2e-initialized", "true");
    }
  });
  await page.goto("/");
});

test("matches the main menu visual baseline", async ({ page }) => {
  await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
  await expect(page).toHaveScreenshot("main-menu.png", {
    animations: "disabled",
    caret: "hide",
  });
});

test("matches the paused arena visual baseline", async ({ page }) => {
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Pause battle" }).click();
  await expect(page.getByRole("heading", { name: "PAUSED" })).toBeVisible();
  await expect(page).toHaveScreenshot("paused-arena.png", {
    animations: "disabled",
    caret: "hide",
  });
});

test("matches the completed result visual baseline", async ({ page }) => {
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__game?.getState() !== null);
  await page.evaluate(() => window.__game?.advanceBy(100));
  await expect(page.getByRole("heading", { name: "VOYAGE COMPLETE" })).toBeVisible();
  await expect(page).toHaveScreenshot("match-result.png", {
    animations: "disabled",
    caret: "hide",
  });
});
