import { expect, test, type Page } from "@playwright/test";

function environmentFlag(name: string): boolean {
  return process.env[name] === "1";
}

const BASELINE_ENABLED = environmentFlag("TERRAFORM_PERFORMANCE_BASELINE");

async function validTerraformPoint(page: Page) {
  const box = await page.getByTestId("game-viewport").boundingBox();
  if (box === null) throw new Error("Game viewport has no bounding box.");
  const game = page.getByTestId("game-screen");
  for (let row = 2; row <= 8; row += 1) {
    for (let column = 1; column <= 9; column += 1) {
      const point = {
        x: box.x + (box.width * column) / 10,
        y: box.y + (box.height * row) / 12,
      };
      await page.mouse.move(point.x, point.y);
      if ((await game.getAttribute("data-terraform-preview")) === "valid") {
        return point;
      }
    }
  }
  throw new Error("No visible valid Terraform target was found.");
}

test.skip(!BASELINE_ENABLED, "Terraform performance baseline is opt-in.");

test("records browser pointer-preview and tap-to-visible-update latency", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/live-city-test.html", { waitUntil: "load" });

  const mount = page.locator("#live-city-test");
  const game = page.getByTestId("game-screen");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");
  await page.getByRole("button", { name: "Terrain", exact: true }).click();
  const point = await validTerraformPoint(page);

  const previewStart = await page.evaluate(() => performance.now());
  await page.mouse.move(point.x + 1, point.y + 1);
  await expect(game).toHaveAttribute("data-terraform-preview", "valid");
  const previewEnd = await page.evaluate(() => performance.now());

  const revisionBefore = Number(
    await game.getAttribute("data-terrain-revision"),
  );
  const commitStart = await page.evaluate(() => performance.now());
  await page.mouse.click(point.x, point.y);
  await expect(game).toHaveAttribute(
    "data-terrain-revision",
    String(revisionBefore + 1),
  );
  const commitEnd = await page.evaluate(() => performance.now());

  const heapUsedBytes = await page.evaluate(() => {
    const memory = (
      performance as Performance & {
        readonly memory?: { readonly usedJSHeapSize?: number };
      }
    ).memory;
    return memory?.usedJSHeapSize;
  });

  expect(errors).toEqual([]);
  const report = Object.freeze({
    schema: "terraform-browser-performance-baseline-v1",
    interactionLatencyMilliseconds: {
      pointerToVisiblePreview: previewEnd - previewStart,
      tapToVisibleTerrainUpdate: commitEnd - commitStart,
    },
    jsHeapUsedBytes: heapUsedBytes,
    resourceDiagnostics: {
      terrainSectors: Number(await game.getAttribute("data-terrain-sectors")),
      terraformUndoDepth: Number(
        await game.getAttribute("data-terraform-undo-depth"),
      ),
    },
    note: "Interaction latency baseline only; headless browser frame intervals are not interpreted as player FPS.",
  });

  console.info(
    `TERRAFORM_BROWSER_PERFORMANCE_BASELINE ${JSON.stringify(report)}`,
  );
});
