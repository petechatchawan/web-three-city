import { expect, test } from "@playwright/test";

test("renders state-oriented reusable UI component semantics", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-components-test.html");

  const root = page.locator("#ui-components-test");
  await expect(root).toHaveAttribute("data-ready", "true");

  await expect(page.getByRole("button", { name: "Raise" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Lower" }).click();
  await expect(root).toHaveAttribute("data-operation", "lower");

  await page.getByRole("checkbox", { name: "Show grid" }).check();
  await expect(root).toHaveAttribute("data-checkbox", "true");
  await page.getByRole("radio", { name: "Expanded" }).check();
  await expect(root).toHaveAttribute("data-radio", "expanded");
  await page.getByRole("slider", { name: "Brush opacity" }).fill("75");
  await expect(root).toHaveAttribute("data-slider", "75");

  await expect(page.getByRole("tab", { name: "Terrain tab" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Roads tab" }).click();
  await expect(page.getByText("Road controls")).toBeVisible();
  await expect(root).toHaveAttribute("data-tab", "roads");

  await page.getByRole("button", { name: "Open options" }).click();
  await expect(page.getByText("Popover content")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Popover content")).toBeHidden();

  const openDialog = page.getByRole("button", { name: "Open dialog" });
  await openDialog.click();
  await expect(page.getByRole("dialog", { name: "Delete city" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel dialog" }).click();
  await expect(page.getByRole("dialog", { name: "Delete city" })).toBeHidden();
  await expect(openDialog).toBeFocused();

  for (const control of [
    page.getByRole("button", { name: "Raise" }),
    page.getByRole("checkbox", { name: "Show grid" }),
    page.getByRole("button", { name: "Open options" }),
  ]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  expect(errors).toEqual([]);
});

test("generic game patterns own tool, context, modal and notification semantics", async ({
  page,
}) => {
  await page.goto("/ui-components-test.html");
  const root = page.locator("#ui-components-test");
  await expect(root).toHaveAttribute("data-ready", "true");

  const terrain = page.getByRole("button", { name: "Terrain", exact: true });
  await expect(terrain).toHaveAttribute("aria-pressed", "true");
  const roads = page.getByRole("button", { name: "Roads" });
  await expect(roads).toBeDisabled();
  await expect(roads).toHaveAttribute("title", "Requires milestone");
  await expect(page.getByRole("button", { name: "Zones" })).toHaveCount(0);

  await terrain.evaluate((element) => {
    (element as HTMLElement).dataset.identityProbe = "stable";
  });
  await page.getByRole("button", { name: "Close Terrain tools" }).click();
  await expect(root).toHaveAttribute("data-context-dismissed", "true");
  await expect(terrain).toHaveAttribute("data-identity-probe", "stable");

  const world = page.getByTestId("pattern-world-underlay");
  await expect(world).not.toHaveAttribute("inert", "");
  const openHosted = page.getByRole("button", { name: "Open hosted dialog" });
  await openHosted.focus();
  await openHosted.click();
  await expect(world).toHaveAttribute("inert", "");
  const hosted = page.getByRole("dialog", { name: "Hosted confirmation" });
  await expect(hosted).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hosted first" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Hosted last" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Hosted first" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(world).not.toHaveAttribute("inert", "");
  await expect(openHosted).toBeFocused();

  const notify = page.getByRole("button", { name: "Notify" });
  await notify.focus();
  await notify.click();
  await expect(page.getByRole("status")).toContainText("City saved");
  await expect(notify).toBeFocused();

  for (const control of [
    terrain,
    roads,
    page.getByRole("button", { name: "Notify" }),
  ]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});
