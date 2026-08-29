import { expect, test } from "@playwright/test";

test("boots the production city lifecycle home without uncaught page errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  const app = page.locator("#app");
  await expect(app).toHaveAttribute("data-bootstrap", "ready");
  await expect(app).toHaveAttribute("data-screen", "home");
  await expect(
    page.getByRole("heading", { name: "Web Three City", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "New City" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load City" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Resume / })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("shows a stable startup error when city save storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(IDBFactory.prototype, "open", {
      configurable: true,
      value() {
        throw new Error("forced IndexedDB startup failure");
      },
    });
  });

  await page.goto("/");

  const app = page.locator("#app");
  await expect(app).toHaveAttribute("data-bootstrap", "error");
  await expect(app).toHaveAttribute("data-screen", "startup-error");
  await expect(page.getByRole("alert")).toContainText(
    "City save storage is unavailable",
  );
  await expect(page.getByRole("button", { name: "New City" })).toHaveCount(0);
});
