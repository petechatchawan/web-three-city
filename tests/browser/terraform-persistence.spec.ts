import { expect, test, type Page } from "@playwright/test";
import { gameMenuAction } from "./game-menu-test-helpers";

const GOLDEN_SEED = "0x5EED5EED5EED5EED";

async function createCity(page: Page): Promise<void> {
  const app = page.locator("#app");
  await page.goto("/");
  await expect(app).toHaveAttribute("data-screen", "home");
  await page.getByRole("button", { name: "New City" }).click();
  await page.getByLabel("City name").fill("Terraform Persistence");
  await page.getByLabel("Terrain seed").fill(GOLDEN_SEED);
  await page.getByRole("button", { name: "Generate terrain" }).click();
  await page.getByRole("radio", { name: "R08" }).check();
  await page.getByRole("button", { name: "Create city" }).click();
  await expect(app).toHaveAttribute("data-live-runtime", "ready");
}

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

async function savedTerrain(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("web-three-city");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = database.transaction("cities", "readonly");
      const getAll = transaction.objectStore("cities").getAll();
      const records = await new Promise<Record<string, unknown>[]>(
        (resolve, reject) => {
          getAll.onsuccess = () =>
            resolve(getAll.result as Record<string, unknown>[]);
          getAll.onerror = () => reject(getAll.error);
        },
      );
      const saved = records[0] as {
        terrainSnapshot: { revision: number; chunks: unknown[] };
        terraformSnapshot?: unknown;
      };
      return {
        revision: saved.terrainSnapshot.revision,
        chunksJson: JSON.stringify(saved.terrainSnapshot.chunks),
        hasTerrainSnapshot: saved.terrainSnapshot !== undefined,
        hasTerraformSnapshot: Object.prototype.hasOwnProperty.call(
          saved,
          "terraformSnapshot",
        ),
      };
    } finally {
      database.close();
    }
  });
}

test("Terraform edits persist through unchanged CitySaveV1 Terrain authority and Undo resets on Load", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await createCity(page);
  const app = page.locator("#app");
  const game = page.getByTestId("game-screen");

  await gameMenuAction(page, "Save City");
  await expect(page.getByText("City saved", { exact: true })).toBeVisible();
  const before = await savedTerrain(page);
  await gameMenuAction(page, "Resume");

  await page.getByRole("button", { name: "Terrain", exact: true }).click();
  const point = await validTerraformPoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(game).toHaveAttribute("data-terraform-undo-depth", "1");
  const editedRevision = Number(
    await game.getAttribute("data-terrain-revision"),
  );
  expect(editedRevision).toBe(before.revision + 1);

  await gameMenuAction(page, "Save City");
  await expect(page.getByText("City saved", { exact: true })).toBeVisible();
  const postEdit = await savedTerrain(page);
  expect(postEdit.revision).toBe(editedRevision);
  expect(postEdit.chunksJson).not.toBe(before.chunksJson);
  expect(postEdit.hasTerrainSnapshot).toBe(true);
  expect(postEdit.hasTerraformSnapshot).toBe(false);

  await gameMenuAction(page, "Exit City");
  await expect(app).toHaveAttribute("data-screen", "home");
  await page.getByRole("button", { name: "Load City" }).click();
  await page
    .getByRole("button", { name: "Select Terraform Persistence" })
    .click();
  await page.getByRole("button", { name: "Load City", exact: true }).click();
  await expect(app).toHaveAttribute("data-live-runtime", "ready");
  await expect(game).toHaveAttribute(
    "data-terrain-revision",
    String(postEdit.revision),
  );
  await expect(game).toHaveAttribute("data-terraform-undo-depth", "0");

  await gameMenuAction(page, "Save City");
  await expect(page.getByText("City saved", { exact: true })).toBeVisible();
  const roundTripped = await savedTerrain(page);
  expect(roundTripped.revision).toBe(postEdit.revision);
  expect(roundTripped.chunksJson).toBe(postEdit.chunksJson);
  expect(roundTripped.hasTerraformSnapshot).toBe(false);
});
