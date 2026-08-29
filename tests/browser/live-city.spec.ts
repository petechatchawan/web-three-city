import { expect, test } from "@playwright/test";

test("composes a live city with Terrain, camera, picking, debug and lifecycle controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/live-city-test.html");

  const mount = page.locator("#live-city-test");
  const game = page.getByTestId("game-screen");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");
  await expect(game).toBeVisible();
  await expect(game).toHaveAttribute("data-terrain-sectors", "64");
  await expect(game).toHaveAttribute("data-input-controller", "ready");
  await expect(game).toHaveAttribute("data-pick-status", "hit");
  await expect(page.getByTestId("game-viewport")).toHaveAttribute(
    "data-webgl",
    "available",
  );

  await page.getByText("Terrain Debug", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Gameplay grid" }).check();
  await expect(game).toHaveAttribute("data-debug-layers", "cellGrid");

  await page.getByRole("button", { name: "Save city" }).click();
  await expect(mount).toHaveAttribute("data-saves", "1");
  await expect(page.getByText("Saved")).toBeVisible();

  await page.getByRole("button", { name: "Exit city" }).click();
  await expect(mount).toHaveAttribute("data-exits", "1");
  await expect(mount).toHaveAttribute("data-live-runtime", "disposed");
  await expect(page.locator("canvas.app-canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
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
