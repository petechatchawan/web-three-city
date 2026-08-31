import { expect, test } from "@playwright/test";

test("production HUD keeps only city identity and global menu entry", async ({
  page,
}) => {
  await page.goto("/live-city-test.html");
  const mount = page.locator("#live-city-test");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");

  await expect(page.getByRole("heading", { name: "Live City" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open game menu" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save city" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exit city" })).toHaveCount(0);
  await expect(page.getByText(/0x5EED5EED5EED5EED/)).toHaveCount(0);
  await expect(page.getByText("Terrain Debug · 0 active")).toHaveCount(0);
});

test("Game Menu owns save, debug and exit while save feedback uses notifications", async ({
  page,
}) => {
  await page.goto("/live-city-test.html");
  const mount = page.locator("#live-city-test");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");

  await page.getByRole("button", { name: "Open game menu" }).click();
  const menu = page.getByRole("dialog", { name: "Game menu" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: "Resume" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Save City" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Debug" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Exit City" })).toBeVisible();

  await menu.getByRole("button", { name: "Save City" }).click();
  await expect(mount).toHaveAttribute("data-saves", "1");
  await expect(page.getByText("City saved", { exact: true })).toBeVisible();
  await expect(menu).toBeVisible();

  await menu.getByRole("button", { name: "Debug" }).click();
  await expect(menu).toBeHidden();
  const debug = page.getByRole("region", { name: "Terrain Debug" });
  await expect(debug).toBeVisible();
  await expect(
    debug.getByRole("checkbox", { name: "Gameplay grid" }),
  ).toBeVisible();
  await debug.getByRole("button", { name: "Close debug" }).click();
  await expect(debug).toBeHidden();

  await page.getByRole("button", { name: "Open game menu" }).click();
  await menu.getByRole("button", { name: "Exit City" }).click();
  await expect(mount).toHaveAttribute("data-exits", "1");
  await expect(mount).toHaveAttribute("data-live-runtime", "disposed");
});

test("central dismissal closes foreground UI before tools and toggles Game Menu last", async ({
  page,
}) => {
  await page.goto("/live-city-test.html");
  const mount = page.locator("#live-city-test");
  const game = page.getByTestId("game-screen");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");

  await page.getByRole("button", { name: "Terrain", exact: true }).click();
  await expect(game).toHaveAttribute("data-active-tool", "terrain");
  await page.keyboard.press("Escape");
  await expect(game).toHaveAttribute("data-active-tool", "");
  await expect(page.getByRole("dialog", { name: "Game menu" })).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Game menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Game menu" })).toBeHidden();
});
