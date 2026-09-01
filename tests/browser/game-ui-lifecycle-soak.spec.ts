import { expect, test, type Page } from "@playwright/test";
import { gameMenuAction } from "./game-menu-test-helpers";

const GOLDEN_SEED = "0x5EED5EED5EED5EED";
const SOAK_CYCLES = 20;
const SOAK_ENABLED = process.env.GAME_UI_LIFECYCLE_SOAK === "1";

interface UiLifecycleDiagnostics {
  readonly activeTrackedListeners: number;
  readonly pendingAnimationFrames: number;
}

async function diagnostics(page: Page): Promise<UiLifecycleDiagnostics> {
  return page.evaluate(() => {
    const source = (
      window as unknown as {
        readonly __gameUiLifecycleDiagnostics?: {
          snapshot(): UiLifecycleDiagnostics;
        };
      }
    ).__gameUiLifecycleDiagnostics;
    if (source === undefined) {
      throw new Error("Game UI lifecycle diagnostics were not installed.");
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

test.skip(!SOAK_ENABLED, "Game UI lifecycle soak is opt-in.");

test("cycles lifecycle screens, preview, game UI and Terrain without accumulating owners", async ({
  page,
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

    const requestFrame = window.requestAnimationFrame.bind(window);
    const cancelFrame = window.cancelAnimationFrame.bind(window);
    const pendingFrames = new Set<number>();
    window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      let handle = 0;
      handle = requestFrame((time) => {
        pendingFrames.delete(handle);
        callback(time);
      });
      pendingFrames.add(handle);
      return handle;
    };
    window.cancelAnimationFrame = (handle: number): void => {
      pendingFrames.delete(handle);
      cancelFrame(handle);
    };

    Object.defineProperty(window, "__gameUiLifecycleDiagnostics", {
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

  // Create one persistent city used by alternating Load/Resume paths.
  await page.getByRole("button", { name: "New City" }).click();
  await page.getByLabel("City name").fill("Game UI Soak City");
  await page.getByLabel("Terrain seed").fill(GOLDEN_SEED);
  await page.getByRole("button", { name: "Generate terrain" }).click();
  await page.getByRole("radio", { name: "R08" }).check();
  await page.getByRole("button", { name: "Create city" }).click();
  await expect(app).toHaveAttribute("data-live-runtime", "ready");
  await gameMenuAction(page, "Save City");
  await expect(page.getByText("City saved", { exact: true })).toBeVisible();
  await gameMenuAction(page, "Exit City");
  await expect(app).toHaveAttribute("data-screen", "home");

  const homeListenerBaseline = (await diagnostics(page)).activeTrackedListeners;
  let liveListenerBaseline: number | undefined;

  for (let cycle = 0; cycle < SOAK_CYCLES; cycle += 1) {
    // Preview lifecycle: one canvas while active, zero after Back.
    await page.getByRole("button", { name: "New City" }).click();
    await page.getByLabel("City name").fill(`Preview ${cycle}`);
    await page.getByLabel("Terrain seed").fill(GOLDEN_SEED);
    await page.getByRole("button", { name: "Generate terrain" }).click();
    const preview = page.getByTestId("new-city-terrain-preview");
    await expect(preview).toHaveAttribute("data-preview-runtime", "ready");
    await expect(preview.locator("canvas.app-canvas")).toHaveCount(1);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(app).toHaveAttribute("data-screen", "home");
    await expect(page.locator("canvas.app-canvas")).toHaveCount(0);

    // Load screen is lightweight and leaves no presentation roots on Back.
    await page.getByRole("button", { name: "Load City" }).click();
    await expect(app).toHaveAttribute("data-screen", "load-city");
    await page.getByRole("button", { name: "Back" }).click();
    await expect(app).toHaveAttribute("data-screen", "home");

    if (cycle % 2 === 0) {
      await page.getByRole("button", { name: "Load City" }).click();
      await page
        .getByRole("button", { name: "Select Game UI Soak City" })
        .click();
      await page
        .getByRole("button", { name: "Load City", exact: true })
        .click();
    } else {
      await page
        .getByRole("button", { name: "Resume Game UI Soak City" })
        .click();
    }
    await expect(app).toHaveAttribute("data-live-runtime", "ready");

    const game = page.getByTestId("game-screen");
    await expect(page.locator("canvas.app-canvas")).toHaveCount(1);
    await expect(page.locator(".game-tool-dock")).toHaveCount(1);
    await expect(page.locator(".game-context-surface")).toHaveCount(1);
    await expect(page.locator("dialog.ui-dialog")).toHaveCount(0);

    const liveDiagnostics = await diagnostics(page);
    if (liveListenerBaseline === undefined) {
      liveListenerBaseline = liveDiagnostics.activeTrackedListeners;
    } else {
      expect(liveDiagnostics.activeTrackedListeners).toBe(liveListenerBaseline);
    }

    await page.getByRole("button", { name: "Terrain", exact: true }).click();
    const point = await validTerraformPoint(page);
    await page.mouse.click(point.x, point.y);
    await expect(game).toHaveAttribute("data-terraform-undo-depth", "1");
    await page.getByRole("button", { name: "Terrain", exact: true }).click();
    await expect(game).toHaveAttribute("data-active-tool", "");

    await page.getByRole("button", { name: "Open game menu" }).click();
    await expect(page.getByRole("dialog", { name: "Game menu" })).toBeVisible();
    await expect(page.locator("dialog.ui-dialog")).toHaveCount(1);
    await gameMenuAction(page, "Resume");
    await expect(page.getByRole("dialog", { name: "Game menu" })).toBeHidden();
    await expect(page.locator("dialog.ui-dialog")).toHaveCount(1);

    await gameMenuAction(page, "Exit City");
    await expect(app).toHaveAttribute("data-screen", "home");
    await expect(page.locator("canvas.app-canvas")).toHaveCount(0);
    await expect(page.locator(".game-tool-dock")).toHaveCount(0);
    await expect(page.locator(".game-context-surface")).toHaveCount(0);
    await expect(page.locator("dialog.ui-dialog")).toHaveCount(0);
    await expect
      .poll(async () => (await diagnostics(page)).pendingAnimationFrames)
      .toBe(0);
    expect((await diagnostics(page)).activeTrackedListeners).toBe(
      homeListenerBaseline,
    );
  }

  expect(errors).toEqual([]);
});
