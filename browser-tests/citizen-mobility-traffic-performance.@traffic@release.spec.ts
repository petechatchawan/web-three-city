import { expect, test } from '@playwright/test';
import { createTrafficPerformanceReleaseFixture } from '../apps/game/src/traffic-performance-release-fixture.js';

const SAVE_KEY = 'web-three-city:world-save:v7';

interface TrafficPerformanceDebug {
  logicalActiveTrips: number;
  spatialCandidates: number;
  visiblePedestrians: number;
  visibleVehicles: number;
  nearAgents: number;
  midAgents: number;
  poolReuseCount: number;
  visitedSpatialBuckets: number;
  totalSpatialBuckets: number;
}

interface TrafficApiSnapshot {
  citizenIds: string[];
  traffic: { activeTrips: unknown[] };
  presentation: TrafficPerformanceDebug | null;
}

async function sampleFrames(page: import('@playwright/test').Page, frameCount: number): Promise<number[]> {
  return page.evaluate(
    (count) =>
      new Promise<number[]>((resolve) => {
        const samples: number[] = [];
        let previous = performance.now();
        const next = (timestamp: number): void => {
          samples.push(timestamp - previous);
          previous = timestamp;
          if (samples.length >= count) resolve(samples);
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      }),
    frameCount,
  );
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

test('5,000 logical trips remain spatially bounded and presentation-capped', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const fixture = createTrafficPerformanceReleaseFixture();
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto('/');
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (window as Window & { __WEB_THREE_CITY_TRAFFIC__?: unknown }).__WEB_THREE_CITY_TRAFFIC__,
        ),
      ),
    )
    .toBe(true);

  await page.evaluate(
    ({ key, payload, focus }) => {
      localStorage.setItem(key, JSON.stringify(payload));
      const api = (window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: {
          loadWorld(): void;
          focusCell(x: number, z: number): void;
        };
      }).__WEB_THREE_CITY_TRAFFIC__;
      if (api === undefined) throw new Error('traffic test API unavailable');
      api.loadWorld();
      api.focusCell(focus.x, focus.z);
    },
    { key: SAVE_KEY, payload: fixture.save, focus: fixture.focusCell },
  );

  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as Window & {
          __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficApiSnapshot };
        }).__WEB_THREE_CITY_TRAFFIC__;
        return api?.snapshot().presentation?.logicalActiveTrips ?? -1;
      }),
      { timeout: 30_000 },
    )
    .toBe(fixture.activeTripCount);

  const before = await page.evaluate(() => {
    const api = (window as Window & {
      __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficApiSnapshot };
    }).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.snapshot();
  });
  const debug = before.presentation;
  expect(before.citizenIds).toHaveLength(fixture.citizenCount);
  expect(before.traffic.activeTrips).toHaveLength(fixture.activeTripCount);
  expect(debug).not.toBeNull();
  expect(debug?.logicalActiveTrips).toBe(fixture.activeTripCount);
  expect(debug?.visiblePedestrians ?? Infinity).toBeLessThanOrEqual(300);
  expect(debug?.visibleVehicles ?? Infinity).toBeLessThanOrEqual(300);
  expect((debug?.nearAgents ?? Infinity)).toBeLessThanOrEqual(500);
  expect(debug?.spatialCandidates ?? Infinity).toBeLessThan(fixture.activeTripCount);
  expect(debug?.visitedSpatialBuckets ?? Infinity).toBeLessThan(debug?.totalSpatialBuckets ?? 0);

  const initialReuse = debug?.poolReuseCount ?? 0;
  await page.evaluate(() => {
    const api = (window as Window & {
      __WEB_THREE_CITY_TRAFFIC__?: { focusCell(x: number, z: number): void };
    }).__WEB_THREE_CITY_TRAFFIC__;
    api?.focusCell(112, 100);
  });
  await page.waitForTimeout(250);
  await page.evaluate((focus) => {
    const api = (window as Window & {
      __WEB_THREE_CITY_TRAFFIC__?: { focusCell(x: number, z: number): void };
    }).__WEB_THREE_CITY_TRAFFIC__;
    api?.focusCell(focus.x, focus.z);
  }, fixture.focusCell);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as Window & {
          __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficApiSnapshot };
        }).__WEB_THREE_CITY_TRAFFIC__;
        return api?.snapshot().presentation?.poolReuseCount ?? 0;
      }),
    )
    .toBeGreaterThan(initialReuse);

  const runs: Array<{
    medianFrameMs: number;
    spreadMs: number;
    minFrameMs: number;
    maxFrameMs: number;
  }> = [];
  for (let run = 0; run < 3; run += 1) {
    const samples = await sampleFrames(page, 30);
    const minimum = Math.min(...samples);
    const maximum = Math.max(...samples);
    runs.push({
      medianFrameMs: median(samples),
      spreadMs: maximum - minimum,
      minFrameMs: minimum,
      maxFrameMs: maximum,
    });
  }
  const memory = await page.evaluate(() => {
    const perf = performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
    };
    return perf.memory === undefined ? null : { ...perf.memory };
  });
  const finalDebug = await page.evaluate(() => {
    const api = (window as Window & {
      __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficApiSnapshot };
    }).__WEB_THREE_CITY_TRAFFIC__;
    return api?.snapshot().presentation ?? null;
  });
  await testInfo.attach('traffic-performance-measurements.json', {
    body: Buffer.from(
      JSON.stringify(
        {
          browser: testInfo.project.name,
          viewport: { width: 414, height: 896 },
          logicalCitizens: fixture.citizenCount,
          logicalActiveTrips: fixture.activeTripCount,
          debug: finalDebug,
          runs,
          medianOfRunMediansMs: median(runs.map((run) => run.medianFrameMs)),
          memory,
          timingGate: 'observational-only',
        },
        null,
        2,
      ),
    ),
    contentType: 'application/json',
  });
});
