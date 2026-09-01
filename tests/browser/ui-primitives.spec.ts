import { expect, test } from "@playwright/test";

test("renders accessible clean UI primitives with 44px interaction targets", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-primitives-test.html");

  const root = page.locator("#ui-primitives-test");
  await expect(root).toHaveAttribute("data-ready", "true");
  await expect(page.getByLabel("City name")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Gameplay grid" }),
  ).toBeVisible();
  await expect(page.locator('.ui-icon[data-ui-icon="terrain"]')).toBeVisible();

  for (const testId of ["ui-primary", "ui-secondary", "ui-switch"]) {
    const box = await page.getByTestId(testId).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  const primary = page.getByTestId("ui-primary");
  await primary.focus();
  await expect(primary).toBeFocused();
  expect(
    await primary.evaluate((element) => getComputedStyle(element).outlineWidth),
  ).not.toBe("0px");

  const card = page.locator(".ui-surface");
  await expect(card).toBeVisible();
  expect(
    await card.evaluate((element) => getComputedStyle(element).borderTopWidth),
  ).toBe("1px");
  await expect(page.getByText("No cities yet")).toBeVisible();

  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--ui-layer-dialog")
        .trim(),
    ),
  ).toBe("60");
  expect(errors).toEqual([]);
});
