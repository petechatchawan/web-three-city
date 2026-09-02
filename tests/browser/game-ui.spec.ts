import { expect, test } from "@playwright/test";

test("production HUD keeps only city identity, categories and global menu entry", async ({
  page,
}) => {
  await page.goto("/live-city-test.html");
  const mount = page.locator("#live-city-test");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");

  const hud = page.locator(".game-hud-pattern");
  const cityIdentity = page.getByRole("heading", { name: "Live City" });
  await expect(cityIdentity).toBeVisible();
  await expect(hud).toHaveAttribute("data-density", "compact");
  expect(
    await cityIdentity.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    ),
  ).toBeLessThanOrEqual(14);

  const hudCenter = page.getByTestId("game-hud-center");
  await expect(hudCenter).toHaveCount(1);
  await expect(hudCenter).toBeHidden();

  const toolDock = page.getByRole("navigation", { name: "Gameplay tools" });
  const categories = toolDock.getByRole("group", { name: "Tool categories" });
  const environment = categories.getByRole("button", {
    name: "Environment",
    exact: true,
  });
  await expect(environment).toBeVisible();
  await expect(environment).toHaveAttribute("aria-expanded", "false");
  await expect(
    toolDock.getByRole("button", { name: "Terrain", exact: true }),
  ).toHaveCount(0);
  await expect(
    categories.getByRole("button", { name: "Build", exact: true }),
  ).toHaveCount(0);
  await expect(
    categories.getByRole("button", { name: "Services", exact: true }),
  ).toHaveCount(0);

  await expect(
    page.getByRole("button", { name: "Open game menu" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save city" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exit city" })).toHaveCount(0);
  await expect(page.getByText(/0x5EED5EED5EED5EED/)).toHaveCount(0);
  await expect(page.getByText("Terrain Debug · 0 active")).toHaveCount(0);
});

test("Tool Dock expands a category before tool activation and never leaves a hidden active tool", async ({
  page,
}) => {
  await page.goto("/live-city-test.html");
  const mount = page.locator("#live-city-test");
  const game = page.getByTestId("game-screen");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");

  const dock = page.getByRole("navigation", { name: "Gameplay tools" });
  const environment = dock.getByRole("button", {
    name: "Environment",
    exact: true,
  });
  await expect(environment).toHaveAttribute("aria-expanded", "false");
  await expect(
    dock.getByRole("button", { name: "Terrain", exact: true }),
  ).toHaveCount(0);

  await environment.click();
  await expect(environment).toHaveAttribute("aria-expanded", "true");
  const terrain = dock.getByRole("button", { name: "Terrain", exact: true });
  await expect(terrain).toBeVisible();

  await terrain.click();
  await expect(game).toHaveAttribute("data-active-tool", "terrain");
  await expect(page.getByTestId("game-context-surface")).toBeVisible();

  await terrain.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(game).toHaveAttribute("data-active-tool", "");
  await expect(environment).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("game-context-surface")).toBeHidden();

  await environment.click();
  await expect(environment).toHaveAttribute("aria-expanded", "false");
  await expect(terrain).toHaveCount(0);
  await expect(game).toHaveAttribute("data-active-tool", "");
});

test("Game Menu keeps production actions while Debug uses the developer shortcut", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/live-city-test.html");
  const mount = page.locator("#live-city-test");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");

  await page.getByRole("button", { name: "Open game menu" }).click();
  const menu = page.getByRole("dialog", { name: "Game menu" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: "Resume" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Save City" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Debug" })).toHaveCount(0);
  await expect(
    menu.getByRole("button", { name: "Exit to Main Menu" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= window.innerWidth &&
        document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);

  await menu.getByRole("button", { name: "Save City" }).click();
  await expect(mount).toHaveAttribute("data-saves", "1");
  await expect(page.getByText("City saved", { exact: true })).toBeVisible();
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Resume" }).click();
  await expect(menu).toBeHidden();

  await page.keyboard.press("F3");
  const debug = page.getByRole("region", { name: "Terrain Debug" });
  await expect(debug).toBeVisible();
  await expect(
    debug.getByRole("checkbox", { name: "Gameplay grid" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(debug).toBeHidden();
  await expect(menu).toBeHidden();

  await page.getByRole("button", { name: "Open game menu" }).click();
  await menu.getByRole("button", { name: "Exit to Main Menu" }).click();
  await expect(mount).toHaveAttribute("data-exits", "1");
  await expect(mount).toHaveAttribute("data-live-runtime", "disposed");
});

test("central dismissal collapses active tool navigation before toggling Game Menu", async ({
  page,
}) => {
  await page.goto("/live-city-test.html");
  const mount = page.locator("#live-city-test");
  const game = page.getByTestId("game-screen");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");

  const dock = page.getByRole("navigation", { name: "Gameplay tools" });
  const environment = dock.getByRole("button", {
    name: "Environment",
    exact: true,
  });
  await environment.click();
  await dock.getByRole("button", { name: "Terrain", exact: true }).click();
  await expect(game).toHaveAttribute("data-active-tool", "terrain");
  await expect(environment).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(game).toHaveAttribute("data-active-tool", "");
  await expect(environment).toHaveAttribute("aria-expanded", "false");
  await expect(
    dock.getByRole("button", { name: "Terrain", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTestId("game-context-surface")).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Game menu" })).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Game menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Game menu" })).toBeHidden();
});

test("T shortcut toggles Terrain with its category while focus and reduced motion remain usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/live-city-test.html");
  const mount = page.locator("#live-city-test");
  const game = page.getByTestId("game-screen");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");

  const dock = page.getByRole("navigation", { name: "Gameplay tools" });
  const environment = dock.getByRole("button", {
    name: "Environment",
    exact: true,
  });

  await page.keyboard.press("T");
  await expect(game).toHaveAttribute("data-active-tool", "terrain");
  await expect(environment).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("game-context-surface")).toBeVisible();

  await page.keyboard.press("T");
  await expect(game).toHaveAttribute("data-active-tool", "");
  await expect(environment).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("game-context-surface")).toBeHidden();

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Open game menu" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(environment).toBeFocused();
  await expect
    .poll(() =>
      environment.evaluate((element) => getComputedStyle(element).outlineWidth),
    )
    .not.toBe("0px");

  await page.keyboard.press("Enter");
  await expect(environment).toHaveAttribute("aria-expanded", "true");
  const terrain = dock.getByRole("button", { name: "Terrain", exact: true });
  await terrain.focus();
  await expect(terrain).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(game).toHaveAttribute("data-active-tool", "terrain");
});
