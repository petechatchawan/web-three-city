import { expect, test } from "@playwright/test";

test("persists canonical city saves through real IndexedDB", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const databaseName = `web-three-city-test-${Date.now()}-${Math.random()}`;

  await page.goto(
    `/city-persistence-test.html?db=${encodeURIComponent(databaseName)}`,
  );
  const root = page.locator("#city-persistence-test");

  await expect(root).toHaveAttribute("data-status", "ready");
  await expect(root).toHaveAttribute("data-list", "city-a,city-b,city-c");
  await expect(root).toHaveAttribute("data-latest", "city-a");
  await expect(root).toHaveAttribute("data-loaded", "city-b");
  await expect(root).toHaveAttribute("data-after-remove", "city-a,city-c");
  await expect(root).toHaveAttribute("data-corrupt", "CITY_REPOSITORY_CORRUPT");
  await expect(root).toHaveAttribute("data-indexes", "lastPlayedAt,updatedAt");
  await expect(root).toHaveAttribute(
    "data-expected-indexes",
    "lastPlayedAt,updatedAt",
  );
  expect(errors).toEqual([]);
});
