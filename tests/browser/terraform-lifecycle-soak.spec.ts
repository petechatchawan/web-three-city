import { expect, test, type Page } from "@playwright/test";
import { gameMenuAction } from "./game-menu-test-helpers";

const GOLDEN_SEED = "0x5EED5EED5EED5EED";
const SOAK_CYCLES = 20;
const SOAK_ENABLED = process.env.TERRAFORM_LIFECYCLE_SOAK === "1";

interface LifecycleDiagnostics {
  readonly activeTrackedListeners: number;
  readonly pendingAnimationFrames: number;
}

async function diagnostics(page: Page): Promise<LifecycleDiagnostics> {
  return page.evaluate(() => {
    const source = (
      window as unknown as {
        readonly __terraformLifecycleDiagnostics?: {
          snapshot(): LifecycleDiagnostics;
        };
      }
    ).__terraformLifecycleDiagnostics;
    if (source === undefined) {
      throw new Error("Terraform lifecycle diagnostics were not installed.");
    }
    return source.snapshot();
  });
}

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

test.skip(!SOAK_ENABLED, "Terraform lifecycle soak is opt-in.");

test("cycles Terraform activation, edits, Load and Resume without leaking lifecycle ownership", async ({
  page,
  context,
}) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.addInitScript(() => {
    const trackedTypes = new Set([
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "wheel",
      "contextmenu",
      "keydown",
      "keyup",
      "blur",
      "visibilitychange",
    ]);
    const targetIds = new WeakMap<object, number>();
    const listenerIds = new WeakMap<object, number>();
    const active = new Set<string>();
    let nextTargetId = 1;
    let nextListenerId = 1;

    const idFor = (
      map: WeakMap<object, number>,
      value: object,
      next: () => number,
    ) => {
      const existing = map.get(value);
      if (existing !== undefined) return existing;
      const created = next();
      map.set(value, created);
      return created;
    };
    const captureFor = (options?: boolean | AddEventListenerOptions) =>
      typeof options === "boolean" ? options : options?.capture === true;
    const keyFor = (
      target: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      const targetId = idFor(targetIds, target as object, () => nextTargetId++);
      const listenerId = idFor(
        listenerIds,
        listener as unknown as object,
        () => nextListenerId++,
      );
      return `${targetId}:${type}:${captureFor(options) ? 1 : 0}:${listenerId}`;
    };

    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (
      type,
      listener,
      options,
    ): void {
      if (listener !== null && trackedTypes.has(type)) {
        const stack = new Error().stack ?? "";
        if (!stack.includes("_setupHitTargetInterceptors")) {
          active.add(keyFor(this, type, listener, options));
        }
      }
      originalAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (
      type,
      listener,
      options,
    ): void {
      if (listener !== null && trackedTypes.has(type)) {
        active.delete(keyFor(this, type, listener, options));
      }
      originalRemove.call(this, type, listener, options);
    };

    const originalRequestAnimationFrame =
      window.requestAnimationFrame.bind(window);
    const originalCancelAnimationFrame =
      window.cancelAnimationFrame.bind(window);
    const pendingFrames = new Set<number>();
    window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      let handle = 0;
      handle = originalRequestAnimationFrame((time) => {
        pendingFrames.delete(handle);
        callback(time);
      });
      pendingFrames.add(handle);
      return handle;
    };
    window.cancelAnimationFrame = (handle: number): void => {
      pendingFrames.delete(handle);
      originalCancelAnimationFrame(handle);
    };

    Object.defineProperty(window, "__terraformLifecycleDiagnostics", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze({
        snapshot: () =>
          Object.freeze({
            activeTrackedListeners: active.size,
            pendingAnimationFrames: pendingFrames.size,
          }),
      }),
    });
  });

  await page.goto("/");
  const app = page.locator("#app");
  await expect(app).toHaveAttribute("data-screen", "home");
  expect((await diagnostics(page)).activeTrackedListeners).toBe(0);

  await page.getByRole("button", { name: "New City" }).click();
  await page.getByLabel("City name").fill("Terraform Soak City");
  await page.getByLabel("Terrain seed").fill(GOLDEN_SEED);
  await page.getByRole("button", { name: "Generate terrain" }).click();
  await page.getByRole("radio", { name: "R08" }).check();
  await page.getByRole("button", { name: "Create city" }).click();
  await expect(app).toHaveAttribute("data-live-runtime", "ready");
  await gameMenuAction(page, "Save City");
  await expect(page.getByText("City saved", { exact: true })).toBeVisible();
  await gameMenuAction(page, "Exit City");
  await expect(app).toHaveAttribute("data-screen", "home");

  let liveListenerCount: number | undefined;
  for (let cycle = 0; cycle < SOAK_CYCLES; cycle += 1) {
    if (cycle % 2 === 0) {
      await page.getByRole("button", { name: "Load City" }).click();
      await page
        .getByRole("button", { name: "Select Terraform Soak City" })
        .click();
      await page
        .getByRole("button", { name: "Load City", exact: true })
        .click();
    } else {
      await page
        .getByRole("button", { name: "Resume Terraform Soak City" })
        .click();
    }

    await expect(app).toHaveAttribute("data-live-runtime", "ready");
    const game = page.getByTestId("game-screen");
    await expect(page.locator("canvas.app-canvas")).toHaveCount(1);
    await expect(game).toHaveAttribute("data-terraform-overlay-roots", "1");
    await expect(game).toHaveAttribute("data-terraform-undo-depth", "0");

    const liveDiagnostics = await diagnostics(page);
    expect(liveDiagnostics.activeTrackedListeners).toBeGreaterThan(0);
    if (liveListenerCount === undefined) {
      liveListenerCount = liveDiagnostics.activeTrackedListeners;
    } else {
      expect(liveDiagnostics.activeTrackedListeners).toBe(liveListenerCount);
    }

    await page.getByRole("button", { name: "Terrain", exact: true }).click();
    const point = await validTerraformPoint(page);
    await expect(game).toHaveAttribute("data-terraform-preview", "valid");
    await page.getByRole("button", { name: "Terrain", exact: true }).click();
    await expect(game).toHaveAttribute("data-terraform-active", "false");
    await page.getByRole("button", { name: "Terrain", exact: true }).click();
    await expect(game).toHaveAttribute("data-terraform-active", "true");

    if (cycle % 5 === 0) {
      await page.mouse.click(point.x, point.y);
      await expect(game).toHaveAttribute("data-terraform-undo-depth", "1");
      await gameMenuAction(page, "Save City");
      await expect(page.getByText("City saved", { exact: true })).toBeVisible();
    }

    await gameMenuAction(page, "Exit City");
    await expect(app).toHaveAttribute("data-screen", "home");
    await expect(page.locator("canvas.app-canvas")).toHaveCount(0);
    await expect
      .poll(async () => (await diagnostics(page)).pendingAnimationFrames)
      .toBe(0);
    expect((await diagnostics(page)).activeTrackedListeners).toBe(0);
  }

  expect(errors).toEqual([]);

  await page.close();
  const cleanup = await context.newPage();
  await cleanup.goto("/ui-primitives-test.html");
  const databaseDelete = await cleanup.evaluate(
    async () =>
      new Promise<"success" | "blocked" | "error" | "timeout">((resolve) => {
        const timer = window.setTimeout(() => resolve("timeout"), 5_000);
        const request = indexedDB.deleteDatabase("web-three-city");
        for (const [eventName, result] of [
          ["success", "success"],
          ["blocked", "blocked"],
          ["error", "error"],
        ] as const) {
          request.addEventListener(
            eventName,
            () => {
              window.clearTimeout(timer);
              resolve(result);
            },
            { once: true },
          );
        }
      }),
  );
  expect(databaseDelete).toBe("success");
  await cleanup.close();
});
