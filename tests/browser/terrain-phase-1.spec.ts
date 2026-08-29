import { expect, test } from "@playwright/test";

test("projects production Terrain through real WebGL and semantic picking", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/terrain-phase-1.html");

  const root = page.locator("#terrain-phase-1");
  await expect(root).toHaveAttribute("data-presentation", "ready");
  await expect(root).toHaveAttribute("data-webgl", "available");
  await expect(root).toHaveAttribute("data-terrain-sectors", "64");
  await expect(root).toHaveAttribute("data-terrain-revision", "0");
  await expect(root).toHaveAttribute("data-pick-status", "hit");
  await expect(root).toHaveAttribute("data-pick-revision", "0");
  await expect(root).toHaveAttribute("data-pick-cell");
  await expect(root).toHaveAttribute(
    "data-pick-triangle",
    /^(SW|NE)_TRIANGLE$/,
  );

  await page.getByTestId("terrain-rebuild").click();
  await expect(root).toHaveAttribute("data-terrain-revision", "1");
  await expect(root).toHaveAttribute("data-presentation-revision", "1");

  expect(errors).toEqual([]);

  await page.goto("about:blank");
  expect(errors).toEqual([]);
});
