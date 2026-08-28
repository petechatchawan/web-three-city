import { expect, test } from "@playwright/test";

test("boots the minimal product shell without uncaught page errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  await expect(page.getByTestId("app-status")).toContainText(
    "Application ready",
  );
  await expect(page.getByTestId("viewport")).toBeVisible();
  await expect(page.locator("#app")).toHaveAttribute("data-bootstrap", "ready");
  expect(errors).toEqual([]);
});
