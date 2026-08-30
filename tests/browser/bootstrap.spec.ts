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

test("rejects corrupt persisted city data without fallback regeneration", async ({
  page,
}) => {
  await page.goto("/");
  const app = page.locator("#app");
  await expect(app).toHaveAttribute("data-bootstrap", "ready");

  await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    const name = databases.find((entry) =>
      entry.name?.includes("web-three-city"),
    )?.name;
    if (name === undefined) throw new Error("City database not found.");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.addEventListener("success", () => resolve(request.result), {
        once: true,
      });
      request.addEventListener("error", () => reject(request.error), {
        once: true,
      });
    });
    try {
      const storeName = database.objectStoreNames.item(0);
      if (storeName === null) throw new Error("City store not found.");
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        transaction.objectStore(storeName).put({
          schemaVersion: 99,
          metadata: { cityId: "corrupt-production-save" },
        });
        transaction.addEventListener("complete", () => resolve(), {
          once: true,
        });
        transaction.addEventListener("error", () => reject(transaction.error), {
          once: true,
        });
        transaction.addEventListener("abort", () => reject(transaction.error), {
          once: true,
        });
      });
    } finally {
      database.close();
    }
  });

  await page.reload();
  await expect(app).toHaveAttribute("data-bootstrap", "error");
  await expect(app).toHaveAttribute("data-screen", "startup-error");
  await expect(page.getByRole("alert")).toContainText(
    "City save storage is unavailable",
  );
  await expect(page.getByRole("button", { name: "New City" })).toHaveCount(0);
});
