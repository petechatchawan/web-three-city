import { expect, test, type Page } from "@playwright/test";

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

test("Terraform mouse tap commits once while navigation gestures never commit", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/live-city-test.html");

  const mount = page.locator("#live-city-test");
  const game = page.getByTestId("game-screen");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");
  await page.getByRole("button", { name: "Environment", exact: true }).click();
  const terrainTool = page.getByRole("button", {
    name: "Terrain",
    exact: true,
  });
  await terrainTool.click();
  await expect(game).toHaveAttribute("data-active-tool", "terrain");
  await expect(game).toHaveAttribute("data-terraform-active", "true");
  await expect(page.getByTestId("game-context-surface")).toBeVisible();
  for (const label of ["Fine 0.25m", "Normal 1m", "Strong 4m"]) {
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "Raise", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await terrainTool.click();
  await expect(game).toHaveAttribute("data-active-tool", "");
  await expect(game).toHaveAttribute("data-terraform-active", "false");
  await expect(page.getByTestId("game-context-surface")).toBeHidden();
  await terrainTool.click();
  await expect(game).toHaveAttribute("data-active-tool", "terrain");
  await expect(game).toHaveAttribute("data-terraform-operation", "raise");
  await expect(game).toHaveAttribute("data-terraform-brush", "1");
  await expect(game).toHaveAttribute("data-terraform-strength", "normal");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();

  const center = await validTerraformPoint(page);
  await expect(game).toHaveAttribute("data-terraform-preview", "valid");
  const beforeRevision = Number(
    await game.getAttribute("data-terrain-revision"),
  );
  await page.mouse.click(center.x, center.y);
  await expect(game).toHaveAttribute(
    "data-terrain-revision",
    String(beforeRevision + 1),
  );
  await expect(game).toHaveAttribute("data-terraform-undo-depth", "1");

  const afterCommit = Number(await game.getAttribute("data-terrain-revision"));
  const beforeTarget = await game.getAttribute("data-camera-target");
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 40, center.y + 20, { steps: 3 });
  await page.mouse.up();
  await expect(game).toHaveAttribute(
    "data-terrain-revision",
    String(afterCommit),
  );
  expect(await game.getAttribute("data-camera-target")).not.toBe(beforeTarget);

  const beforeAzimuth = await game.getAttribute("data-camera-azimuth");
  await page.mouse.move(center.x, center.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(center.x + 40, center.y, { steps: 3 });
  await page.mouse.up({ button: "right" });
  await expect(game).toHaveAttribute(
    "data-terrain-revision",
    String(afterCommit),
  );
  expect(await game.getAttribute("data-camera-azimuth")).not.toBe(
    beforeAzimuth,
  );

  const beforeDistance = await game.getAttribute("data-camera-distance");
  await page.mouse.wheel(0, 180);
  await expect
    .poll(() => game.getAttribute("data-camera-distance"))
    .not.toBe(beforeDistance);
  await expect(game).toHaveAttribute(
    "data-terrain-revision",
    String(afterCommit),
  );
  expect(errors).toEqual([]);
});

test("Flatten first tap selects a canonical level without mutating, then Undo restores the edit", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/live-city-test.html");
  const game = page.getByTestId("game-screen");
  await expect(page.locator("#live-city-test")).toHaveAttribute(
    "data-live-runtime",
    "ready",
  );
  await page.getByRole("button", { name: "Environment", exact: true }).click();
  await page.getByRole("button", { name: "Terrain", exact: true }).click();
  const point = await validTerraformPoint(page);
  await page.getByRole("button", { name: "Flatten", exact: true }).click();
  await expect(page.getByRole("button", { name: "Normal 1m" })).toBeDisabled();

  const before = Number(await game.getAttribute("data-terrain-revision"));
  await page.mouse.click(point.x, point.y);
  await expect(game).toHaveAttribute("data-terrain-revision", String(before));
  await expect(page.getByTestId("terraform-flatten-target")).not.toHaveText(
    "Level: not selected",
  );

  await page.mouse.click(point.x, point.y);
  const edited = Number(await game.getAttribute("data-terrain-revision"));
  expect(edited).toBeGreaterThanOrEqual(before);
  if (edited > before) {
    await page.getByRole("button", { name: /^Undo/ }).click();
    await expect(game).toHaveAttribute("data-terraform-undo-depth", "0");
    await expect(game).toHaveAttribute(
      "data-terrain-revision",
      String(edited + 1),
    );
  }

  await page.keyboard.press("Escape");
  await expect(game).toHaveAttribute("data-active-tool", "");
  await expect(game).toHaveAttribute("data-terraform-active", "false");
  await expect(page.getByTestId("game-context-surface")).toBeHidden();
});
