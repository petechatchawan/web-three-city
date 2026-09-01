import { expect, test } from "@playwright/test";

const SEED_A = "0x5EED5EED5EED5EED";
const SEED_B = "0x00000000000000AB";

test("New City reuses one live Terrain preview runtime across regeneration and disposes it on Back", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const app = page.locator("#app");
  await page.getByRole("button", { name: "New City" }).click();
  await expect(app).toHaveAttribute("data-screen", "new-city");

  await page.getByLabel("City name").fill("Preview City");
  await page.getByLabel("Terrain seed").fill(SEED_A);
  await page.getByRole("button", { name: "Generate terrain" }).click();

  const preview = page.getByTestId("new-city-terrain-preview");
  await expect(preview).toHaveAttribute("data-preview-runtime", "ready");
  await expect(preview).toHaveAttribute("data-preview-canvas-count", "1");
  await expect(preview).toHaveAttribute("data-preview-source-seed", SEED_A);
  await expect(preview.locator("canvas.app-canvas")).toHaveCount(1);

  const detachedPreview = await preview.elementHandle();
  expect(detachedPreview).not.toBeNull();

  await page.getByLabel("Terrain seed").fill(SEED_B);
  await expect(page.getByTestId("new-city-screen")).toHaveAttribute(
    "data-preview-fresh",
    "false",
  );
  await expect(
    page.getByRole("button", { name: "Create city" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Generate terrain" }).click();
  await expect(preview).toHaveAttribute("data-preview-runtime", "ready");
  await expect(preview).toHaveAttribute("data-preview-canvas-count", "1");
  await expect(preview).toHaveAttribute("data-preview-source-seed", SEED_B);
  await expect(preview.locator("canvas.app-canvas")).toHaveCount(1);

  const eligibleRegion = page.getByRole("radio").first();
  await expect(eligibleRegion).toBeVisible();
  await eligibleRegion.check();
  await expect(page.getByRole("button", { name: "Create city" })).toBeEnabled();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(app).toHaveAttribute("data-screen", "home");
  await expect(page.locator("canvas.app-canvas")).toHaveCount(0);
  expect(await detachedPreview?.getAttribute("data-preview-runtime")).toBe(
    "disposed",
  );
  expect(
    await detachedPreview?.evaluate(
      (element) => element.querySelectorAll("canvas.app-canvas").length,
    ),
  ).toBe(0);
});
