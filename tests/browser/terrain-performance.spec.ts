import { expect, test } from "@playwright/test";

function environmentFlag(name: string): boolean {
  const processValue = Reflect.get(globalThis, "process");
  if (typeof processValue !== "object" || processValue === null) return false;
  const environment = Reflect.get(processValue, "env");
  if (typeof environment !== "object" || environment === null) return false;
  return Reflect.get(environment, name) === "1";
}

const BASELINE_ENABLED = environmentFlag("TERRAIN_PERFORMANCE_BASELINE");

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) throw new Error("Cannot measure an empty sample set.");
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  const value = sorted[index];
  if (value === undefined) throw new Error("Percentile sample unavailable.");
  return value;
}

test.skip(!BASELINE_ENABLED, "Terrain performance baseline is opt-in.");

test("records browser first-ready, active frame interval and JS heap baseline", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/live-city-test.html", { waitUntil: "load" });
  const mount = page.locator("#live-city-test");
  const game = page.getByTestId("game-screen");
  await expect(mount).toHaveAttribute("data-live-runtime", "ready");
  await expect(game).toHaveAttribute("data-terrain-sectors", "64");
  await expect(page.getByTestId("game-viewport")).toHaveAttribute(
    "data-webgl",
    "available",
  );

  const firstReadyMilliseconds = await page.evaluate(() => performance.now());
  const heapUsedBytes = await page.evaluate(() => {
    const memory = (
      performance as Performance & {
        readonly memory?: { readonly usedJSHeapSize?: number };
      }
    ).memory;
    return memory?.usedJSHeapSize;
  });

  await page.keyboard.down("w");
  const frameIntervals = await page.evaluate(async () => {
    const samples: number[] = [];
    let previous = performance.now();
    for (let index = 0; index < 60; index += 1) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      const now = performance.now();
      samples.push(now - previous);
      previous = now;
    }
    return samples;
  });
  await page.keyboard.up("w");

  expect(frameIntervals).toHaveLength(60);
  expect(frameIntervals.every((value) => Number.isFinite(value))).toBe(true);
  expect(errors).toEqual([]);

  const report = Object.freeze({
    schema: "terrain-browser-performance-baseline-v1",
    firstReadyMilliseconds,
    activeFrameIntervalMilliseconds: {
      p50: percentile(frameIntervals, 0.5),
      p95: percentile(frameIntervals, 0.95),
      max: Math.max(...frameIntervals),
    },
    jsHeapUsedBytes: heapUsedBytes,
    viewport: await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    })),
  });

  console.info(
    `TERRAIN_BROWSER_PERFORMANCE_BASELINE ${JSON.stringify(report)}`,
  );
});
