import { expect, test } from "@playwright/test";

test("Terraform disposal removes toolbar-owned click listeners", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const active = new Set<string>();
    const ids = new WeakMap<object, number>();
    let nextId = 1;
    const idFor = (value: object): number => {
      const existing = ids.get(value);
      if (existing !== undefined) return existing;
      const created = nextId++;
      ids.set(value, created);
      return created;
    };
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (
      type,
      listener,
      options,
    ): void {
      if (
        type === "click" &&
        listener !== null &&
        this instanceof HTMLElement &&
        this.dataset.testid?.startsWith("terraform-")
      ) {
        active.add(`${idFor(this)}:${idFor(listener as object)}`);
      }
      originalAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (
      type,
      listener,
      options,
    ): void {
      if (
        type === "click" &&
        listener !== null &&
        this instanceof HTMLElement &&
        this.dataset.testid?.startsWith("terraform-")
      ) {
        active.delete(`${idFor(this)}:${idFor(listener as object)}`);
      }
      originalRemove.call(this, type, listener, options);
    };
    Object.defineProperty(window, "__terraformToolbarListenerCount", {
      configurable: false,
      value: () => active.size,
    });
  });

  await page.goto("/live-city-test.html");
  const mount = page.locator("#live-city-test");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");
  expect(
    await page.evaluate(() =>
      (
        window as unknown as {
          __terraformToolbarListenerCount: () => number;
        }
      ).__terraformToolbarListenerCount(),
    ),
  ).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Exit city" }).click();
  await expect(mount).toHaveAttribute("data-live-runtime", "disposed");
  expect(
    await page.evaluate(() =>
      (
        window as unknown as {
          __terraformToolbarListenerCount: () => number;
        }
      ).__terraformToolbarListenerCount(),
    ),
  ).toBe(0);
});
