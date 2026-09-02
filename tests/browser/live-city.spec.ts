import { expect, test } from "@playwright/test";

test("composes a live city with Terrain, camera, picking and production game UI", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/live-city-test.html");

  const mount = page.locator("#live-city-test");
  const game = page.getByTestId("game-screen");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");
  await expect(game).toBeVisible();
  await expect(page.getByTestId("game-hud-host")).toBeVisible();
  await expect(page.getByTestId("game-tool-dock-host")).toBeVisible();
  await expect(page.getByTestId("game-context-host")).toBeAttached();
  await expect(page.getByTestId("game-inspector-host")).toBeAttached();
  await expect(page.getByTestId("game-dialog-host")).toBeAttached();
  await expect(page.getByTestId("game-notification-host")).toBeAttached();
  await expect(page.getByTestId("game-debug-host")).toBeAttached();
  await expect(game).toHaveAttribute("data-terrain-sectors", "64");
  await expect(game).toHaveAttribute("data-input-controller", "ready");
  await expect(game).toHaveAttribute("data-pick-status", "hit");
  await expect(page.getByTestId("game-viewport")).toHaveAttribute(
    "data-webgl",
    "available",
  );

  const viewport = page.getByTestId("game-viewport");
  await expect(game).toHaveAttribute("data-camera-target");
  await expect(game).toHaveAttribute("data-camera-azimuth");
  await expect(game).toHaveAttribute("data-camera-distance");

  const beforeW = await game.getAttribute("data-camera-target");
  await page.keyboard.down("w");
  await page.waitForTimeout(100);
  await page.keyboard.up("w");
  const atRelease = await game.getAttribute("data-camera-target");
  expect(atRelease).not.toBe(beforeW);
  await page.waitForTimeout(60);
  const afterRelease = await game.getAttribute("data-camera-target");
  expect(afterRelease).not.toBe(atRelease);

  const beforeQ = Number(await game.getAttribute("data-camera-azimuth"));
  await page.keyboard.down("q");
  await page.waitForTimeout(100);
  await page.keyboard.up("q");
  const afterQ = Number(await game.getAttribute("data-camera-azimuth"));
  expect(afterQ).toBeGreaterThan(beforeQ);

  const beforeE = Number(await game.getAttribute("data-camera-azimuth"));
  await page.keyboard.down("e");
  await page.waitForTimeout(300);
  await page.keyboard.up("e");
  const afterE = Number(await game.getAttribute("data-camera-azimuth"));
  expect(afterE).toBeLessThan(beforeE);

  const wheelResult = await viewport.evaluate((element) => {
    const game = document.querySelector<HTMLElement>(
      "[data-testid='game-screen']",
    );
    if (game === null) throw new Error("Game screen unavailable.");
    const before = game.dataset.cameraDistance;
    element.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 180, cancelable: true, bubbles: true }),
    );
    return { before, immediate: game.dataset.cameraDistance };
  });
  expect(wheelResult.immediate).toBe(wheelResult.before);
  await expect
    .poll(() => game.getAttribute("data-camera-distance"))
    .not.toBe(wheelResult.before);

  await expect(page.getByText("Terrain Debug · 0 active")).toHaveCount(0);
  await page.keyboard.press("F3");
  const debug = page.getByRole("region", { name: "Terrain Debug" });
  await expect(debug).toBeVisible();
  const clearDebug = debug.getByRole("button", { name: "Clear debug" });
  await expect(clearDebug).toBeDisabled();
  await debug.getByRole("checkbox", { name: "Gameplay grid" }).check();
  await expect(game).toHaveAttribute("data-debug-layers", "cellGrid");
  await expect(clearDebug).toBeEnabled();
  await clearDebug.click();
  await expect(game).toHaveAttribute("data-debug-layers", "");
  await debug.getByRole("button", { name: "Close debug" }).click();

  await page.getByRole("button", { name: "Open game menu" }).click();
  const menu = page.getByRole("dialog", { name: "Game menu" });
  await menu.getByRole("button", { name: "Save City" }).click();
  await expect(mount).toHaveAttribute("data-saves", "1");
  await expect(page.getByText("City saved", { exact: true })).toBeVisible();

  await menu.getByRole("button", { name: "Exit to Main Menu" }).click();
  await expect(mount).toHaveAttribute("data-exits", "1");
  await expect(mount).toHaveAttribute("data-live-runtime", "disposed");
  await expect(page.locator("canvas.app-canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("save failure reports an error notification and keeps the live city running", async ({
  page,
}) => {
  await page.goto("/live-city-test.html?save=fail");
  const mount = page.locator("#live-city-test");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");

  await page.getByRole("button", { name: "Open game menu" }).click();
  await page
    .getByRole("dialog", { name: "Game menu" })
    .getByRole("button", { name: "Save City" })
    .click();

  await expect(mount).toHaveAttribute("data-saves", "1");
  await expect(page.getByRole("alert")).toContainText("Save failed for test");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");
  await expect(page.locator("canvas.app-canvas")).toHaveCount(1);
});

test("live city shell fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/live-city-test.html");
  await expect(page.locator("#live-city-test")).toHaveAttribute(
    "data-live-runtime",
    "ready",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});
