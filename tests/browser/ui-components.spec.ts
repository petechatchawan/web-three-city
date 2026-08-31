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
