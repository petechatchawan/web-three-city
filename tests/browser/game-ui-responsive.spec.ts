import { expect, test, type Page } from "@playwright/test";

const PROFILES = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "small-desktop", width: 1024, height: 768 },
  { name: "mobile-portrait", width: 390, height: 844 },
  { name: "mobile-landscape", width: 844, height: 390 },
  { name: "minimum", width: 320, height: 568 },
] as const;

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

async function expectInsideViewport(
  page: Page,
  selector: string,
): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  if (box === null) throw new Error(`${selector} has no bounding box.`);
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("Viewport is unavailable.");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
}

for (const profile of PROFILES) {
  test(`${profile.name} keeps lifecycle screens and game shell inside the viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: profile.width,
      height: profile.height,
    });

    for (const screen of ["home-populated", "new", "load-populated"] as const) {
      await page.goto(`/city-screens-test.html?screen=${screen}`);
      await expect(page.locator("#city-screens-test")).toHaveAttribute(
        "data-ready",
        "true",
      );
      await expectNoHorizontalOverflow(page);
    }

    await page.goto("/live-city-test.html");
    await expect(page.locator("#live-city-test")).toHaveAttribute(
      "data-live-runtime",
      "ready",
    );
    await expectNoHorizontalOverflow(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= window.innerHeight,
      ),
    ).toBe(true);
    await expectInsideViewport(page, ".game-tool-dock");

    await page.getByRole("button", { name: "Terrain", exact: true }).click();
    await expect(page.getByTestId("game-screen")).toHaveAttribute(
      "data-active-tool",
      "terrain",
    );
    await expectInsideViewport(page, ".game-tool-dock");
    await expectInsideViewport(page, ".game-context-surface");
  });
}

test("Compact layout uses one full-width tool zone and a non-overlapping Context bottom sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/live-city-test.html");
  await expect(page.locator("#live-city-test")).toHaveAttribute(
    "data-live-runtime",
    "ready",
  );

  const dock = page.locator(".game-tool-dock");
  const dockBox = await dock.boundingBox();
  if (dockBox === null) throw new Error("Tool Dock has no bounding box.");
  expect(dockBox.width).toBeGreaterThanOrEqual(366);

  await page.getByRole("button", { name: "Terrain", exact: true }).click();
  const context = page.getByTestId("game-context-surface");
  const contextBox = await context.boundingBox();
  const activeDockBox = await dock.boundingBox();
  if (contextBox === null || activeDockBox === null) {
    throw new Error("Compact game surfaces have no bounding box.");
  }
  expect(contextBox.width).toBeGreaterThanOrEqual(366);
  expect(contextBox.y + contextBox.height).toBeLessThanOrEqual(
    activeDockBox.y - 8,
  );
  await expectNoHorizontalOverflow(page);
});

test("Compact New City is preview-first with configuration foregrounded at the bottom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/city-screens-test.html?screen=new");
  const preview = page.getByTestId("new-city-terrain-preview");
  const config = page.locator(".new-city-layout > .ui-surface");
  const previewBox = await preview.boundingBox();
  const configBox = await config.boundingBox();
  if (previewBox === null || configBox === null) {
    throw new Error("New City responsive surfaces are unavailable.");
  }

  expect(previewBox.y).toBeLessThan(configBox.y);
  expect(previewBox.width).toBeGreaterThanOrEqual(358);
  expect(configBox.y + configBox.height).toBeLessThanOrEqual(844);
  await expectNoHorizontalOverflow(page);
});

test("Compact Load City presents list first and foregrounds detail only after selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/city-screens-test.html?screen=load-populated");
  const list = page.locator(".load-city-browser__list");
  const detail = page.getByTestId("load-city-detail");
  await expect(list).toBeVisible();
  await expect(detail).toBeHidden();

  await page.getByRole("button", { name: "Select Metro Beta" }).click();
  await expect(detail).toBeVisible();
  const listBox = await list.boundingBox();
  const detailBox = await detail.boundingBox();
  if (listBox === null || detailBox === null) {
    throw new Error("Load City responsive surfaces are unavailable.");
  }
  expect(detailBox.y).toBeLessThan(listBox.y);
  await expectNoHorizontalOverflow(page);
});

test("Compact production New City keeps the live Terrain preview behind usable local surfaces", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "New City" }).click();
  await page.getByLabel("City name").fill("Responsive Preview");
  await page.getByLabel("Terrain seed").fill("0x5EED5EED5EED5EED");
  await page.getByRole("button", { name: "Generate terrain" }).click();

  const preview = page.getByTestId("new-city-terrain-preview");
  await expect(preview.locator("canvas")).toHaveCount(1);
  const previewBox = await preview.boundingBox();
  const configBox = await page
    .locator(".new-city-layout > .ui-surface")
    .boundingBox();
  if (previewBox === null || configBox === null) {
    throw new Error("Compact production New City surfaces are unavailable.");
  }
  expect(previewBox.x).toBe(0);
  expect(previewBox.y).toBe(0);
  expect(previewBox.width).toBeGreaterThanOrEqual(390);
  expect(previewBox.height).toBeGreaterThanOrEqual(844);
  expect(configBox.y + configBox.height).toBeLessThanOrEqual(844);
  await expect(page.getByRole("radio", { name: "R08" })).toBeVisible();
  await page.getByRole("radio", { name: "R08" }).check();
  await expect(page.getByRole("button", { name: "Create city" })).toBeEnabled();
  await expectNoHorizontalOverflow(page);
});

test("orientation changes preserve the active Terrain tool and responsive surfaces", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/live-city-test.html");
  const game = page.getByTestId("game-screen");
  await expect(page.locator("#live-city-test")).toHaveAttribute(
    "data-live-runtime",
    "ready",
  );
  await page.getByRole("button", { name: "Terrain", exact: true }).click();
  await expect(game).toHaveAttribute("data-active-tool", "terrain");

  for (const viewport of [
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(game).toHaveAttribute("data-active-tool", "terrain");
    await expect(page.getByTestId("game-context-surface")).toBeVisible();
    await expectInsideViewport(page, ".game-tool-dock");
    await expectInsideViewport(page, ".game-context-surface");
    await expectNoHorizontalOverflow(page);
  }
});
