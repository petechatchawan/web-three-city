import { expect, test, type Page } from "@playwright/test";

const GOLDEN_SEED = "0x5EED5EED5EED5EED";
const GOLDEN_FINGERPRINT = "0xF2FA29BFD2AEB069";
const SOAK_CYCLES = 20;

function environmentFlag(name: string): boolean {
  const processValue = Reflect.get(globalThis, "process");
  if (typeof processValue !== "object" || processValue === null) return false;
  const environment = Reflect.get(processValue, "env");
  if (typeof environment !== "object" || environment === null) return false;
  return Reflect.get(environment, name) === "1";
}

const SOAK_ENABLED = environmentFlag("TERRAIN_LIFECYCLE_SOAK");

interface LifecycleDiagnostics {
  readonly activeTrackedListeners: number;
  readonly pendingAnimationFrames: number;
}

async function diagnostics(page: Page): Promise<LifecycleDiagnostics> {
  return page.evaluate(() => {
    const source = (
      window as unknown as {
        readonly __terrainLifecycleDiagnostics?: {
          snapshot(): LifecycleDiagnostics;
        };
      }
    ).__terrainLifecycleDiagnostics;
    if (source === undefined) {
      throw new Error("Terrain lifecycle diagnostics were not installed.");
    }
    return source.snapshot();
  });
}

test.skip(!SOAK_ENABLED, "Terrain lifecycle soak is opt-in.");

test("cycles New, Load and Resume without accumulating presentation resources", async ({
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
        active.add(keyFor(this, type, listener, options));
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

    Object.defineProperty(window, "__terrainLifecycleDiagnostics", {
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
  await expect
    .poll(async () => (await diagnostics(page)).pendingAnimationFrames)
    .toBe(0);
  expect((await diagnostics(page)).activeTrackedListeners).toBe(0);

  await page.getByRole("button", { name: "New City" }).click();
  await page.getByLabel("City name").fill("Terrain Soak City");
  await page.getByLabel("Terrain seed").fill(GOLDEN_SEED);
  await page.getByRole("button", { name: "Generate terrain" }).click();
  await expect(
    page.getByText(GOLDEN_FINGERPRINT, { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "R08" }).check();
  await page.getByRole("button", { name: "Create city" }).click();
  await expect(app).toHaveAttribute("data-live-runtime", "ready");
  await page.getByRole("button", { name: "Save city" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Exit city" }).click();
  await expect(app).toHaveAttribute("data-screen", "home");

  let liveListenerCount: number | undefined;
  for (let cycle = 0; cycle < SOAK_CYCLES; cycle += 1) {
    if (cycle % 2 === 0) {
      await page.getByRole("button", { name: "Load City" }).click();
      await expect(app).toHaveAttribute("data-screen", "load-city");
      await page
        .getByRole("button", { name: "Load Terrain Soak City" })
        .click();
    } else {
      await page
        .getByRole("button", { name: "Resume Terrain Soak City" })
        .click();
    }

    await expect(app).toHaveAttribute("data-screen", "live-city");
    await expect(app).toHaveAttribute("data-live-runtime", "ready");
    const game = page.getByTestId("game-screen");
    await expect(game).toHaveAttribute("data-terrain-sectors", "64");
    await expect(page.locator("canvas.app-canvas")).toHaveCount(1);

    const liveDiagnostics = await diagnostics(page);
    expect(liveDiagnostics.activeTrackedListeners).toBeGreaterThan(0);
    if (liveListenerCount === undefined) {
      liveListenerCount = liveDiagnostics.activeTrackedListeners;
    } else {
      expect(liveDiagnostics.activeTrackedListeners).toBe(liveListenerCount);
    }

    await page.getByRole("button", { name: "Exit city" }).click();
    await expect(app).toHaveAttribute("data-screen", "home");
    await expect(page.locator("canvas.app-canvas")).toHaveCount(0);
    await expect
      .poll(async () => (await diagnostics(page)).pendingAnimationFrames)
      .toBe(0);
    expect((await diagnostics(page)).activeTrackedListeners).toBe(0);
  }

  await expect(
    page.getByRole("button", { name: "Resume Terrain Soak City" }),
  ).toBeVisible();
  expect(errors).toEqual([]);

  await page.close();
  const cleanup = await context.newPage();
  await cleanup.goto("/ui-primitives-test.html");
  const databaseDelete = await cleanup.evaluate(async () => {
    return new Promise<"success" | "blocked" | "error" | "timeout">(
      (resolve) => {
        const timer = window.setTimeout(() => resolve("timeout"), 5_000);
        const request = indexedDB.deleteDatabase("web-three-city");
        request.addEventListener(
          "success",
          () => {
            window.clearTimeout(timer);
            resolve("success");
          },
          { once: true },
        );
        request.addEventListener(
          "blocked",
          () => {
            window.clearTimeout(timer);
            resolve("blocked");
          },
          { once: true },
        );
        request.addEventListener(
          "error",
          () => {
            window.clearTimeout(timer);
            resolve("error");
          },
          { once: true },
        );
      },
    );
  });
  expect(databaseDelete).toBe("success");
  await cleanup.close();
});
