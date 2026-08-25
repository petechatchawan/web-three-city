import { expect, test } from '@playwright/test';

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
  worldRevision: number;
  absoluteGameMinute: number;
  citizenIds: string[];
  traffic: { activeTrips: unknown[] };
  presentation: TrafficPerformanceDebug | null;
  render: {
    calls: number;
    triangles: number;
    roadPageCount: number;
    roadRenderableCount: number;
  };
}

interface TrafficPerformanceFixtureSummary {
  citizenCount: number;
  activeTripCount: number;
  focusCell: { x: number; z: number };
}

async function sampleFrames(
  page: import('@playwright/test').Page,
  frameCount: number,
): Promise<number[]> {
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
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function percentile(values: readonly number[], percentileValue: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index]!;
}

interface FrameSummary {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  over33_4: number;
  over50: number;
  over100: number;
  buckets: {
    under20: number;
    from20To30: number;
    from30To33_4: number;
    from33_4To35: number;
    from35To40: number;
    from40To50: number;
    from50To100: number;
    over100: number;
  };
}

function summarizeFrames(samples: readonly number[]): FrameSummary {
  const buckets = {
    under20: 0,
    from20To30: 0,
    from30To33_4: 0,
    from33_4To35: 0,
    from35To40: 0,
    from40To50: 0,
    from50To100: 0,
    over100: 0,
  };
  for (const sample of samples) {
    if (sample < 20) buckets.under20 += 1;
    else if (sample < 30) buckets.from20To30 += 1;
    else if (sample < 33.4) buckets.from30To33_4 += 1;
    else if (sample < 35) buckets.from33_4To35 += 1;
    else if (sample < 40) buckets.from35To40 += 1;
    else if (sample < 50) buckets.from40To50 += 1;
    else if (sample <= 100) buckets.from50To100 += 1;
    else buckets.over100 += 1;
  }
  return {
    p50: percentile(samples, 50),
    p90: percentile(samples, 90),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
    max: Math.max(...samples),
    over33_4: samples.filter((sample) => sample > 33.4).length,
    over50: samples.filter((sample) => sample > 50).length,
    over100: samples.filter((sample) => sample > 100).length,
    buckets,
  };
}

async function waitForTrafficApi(page: import('@playwright/test').Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (window as Window & { __WEB_THREE_CITY_TRAFFIC__?: unknown }).__WEB_THREE_CITY_TRAFFIC__,
        ),
      ),
    )
    .toBe(true);
}

async function installPerformanceFixture(
  page: import('@playwright/test').Page,
): Promise<{ fixture: TrafficPerformanceFixtureSummary; initial: TrafficApiSnapshot }> {
  await page.goto('/');
  await waitForTrafficApi(page);
  const fixture = await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: {
          installPerformanceFixture(): TrafficPerformanceFixtureSummary;
        };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.installPerformanceFixture();
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = (
            window as Window & {
              __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficApiSnapshot };
            }
          ).__WEB_THREE_CITY_TRAFFIC__;
          return api?.snapshot().presentation?.logicalActiveTrips ?? -1;
        }),
      { timeout: 60_000 },
    )
    .toBe(fixture.activeTripCount);
  const initial = await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficApiSnapshot };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.snapshot();
  });
  return { fixture, initial };
}

async function sampleReleaseRun(
  page: import('@playwright/test').Page,
  mode: 'paused' | 'x1',
): Promise<{
  mode: 'paused' | 'x1';
  frame: FrameSummary;
  render: TrafficApiSnapshot['render'];
  presentation: TrafficPerformanceDebug | null;
  logicalActiveTrips: number;
  revisionDelta: number;
  gameMinuteDelta: number;
}> {
  const { initial } = await installPerformanceFixture(page);
  if (mode === 'x1') {
    await page.evaluate(() => {
      const api = (
        window as Window & { __WEB_THREE_CITY_TIME__?: { setSpeed(speed: 'normal'): void } }
      ).__WEB_THREE_CITY_TIME__;
      if (api === undefined) throw new Error('game time test API unavailable');
      api.setSpeed('normal');
    });
    await expect
      .poll(
        () =>
          page.evaluate((before) => {
            const api = (
              window as Window & {
                __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficApiSnapshot };
              }
            ).__WEB_THREE_CITY_TRAFFIC__;
            const snapshot = api?.snapshot();
            return Math.min(
              (snapshot?.worldRevision ?? 0) - before.worldRevision,
              (snapshot?.absoluteGameMinute ?? 0) - before.absoluteGameMinute,
            );
          }, initial),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);
  }
  await sampleFrames(page, 120);
  const samples = await sampleFrames(page, 600);
  const final = await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficApiSnapshot };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.snapshot();
  });
  return {
    mode,
    frame: summarizeFrames(samples),
    render: final.render,
    presentation: final.presentation,
    logicalActiveTrips: final.presentation?.logicalActiveTrips ?? -1,
    revisionDelta: final.worldRevision - initial.worldRevision,
    gameMinuteDelta: final.absoluteGameMinute - initial.absoluteGameMinute,
  };
}

test('5,000 logical trips remain spatially bounded and presentation-capped', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
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

  const fixture = await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: {
          installPerformanceFixture(): TrafficPerformanceFixtureSummary;
        };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.installPerformanceFixture();
  });
  const afterInstall = await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficApiSnapshot };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.snapshot();
  });
  expect(afterInstall.traffic.activeTrips).toHaveLength(fixture.activeTripCount);

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = (
            window as Window & {
              __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficApiSnapshot };
            }
          ).__WEB_THREE_CITY_TRAFFIC__;
          return api?.snapshot().presentation?.logicalActiveTrips ?? -1;
        }),
      { timeout: 30_000 },
    )
    .toBe(fixture.activeTripCount);

  const before = await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficApiSnapshot };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.snapshot();
  });
  const debug = before.presentation;
  expect(before.citizenIds).toHaveLength(fixture.citizenCount);
  expect(before.traffic.activeTrips).toHaveLength(fixture.activeTripCount);
  expect(before.render.roadPageCount).toBe(4);
  expect(before.render.roadRenderableCount).toBe(4);
  expect(before.render.triangles).toBeLessThanOrEqual(52_500);
  expect(debug).not.toBeNull();
  expect(debug?.logicalActiveTrips).toBe(fixture.activeTripCount);
  expect(debug?.visiblePedestrians ?? Infinity).toBeLessThanOrEqual(300);
  expect(debug?.visibleVehicles ?? Infinity).toBeLessThanOrEqual(300);
  expect(debug?.nearAgents ?? Infinity).toBeLessThanOrEqual(500);
  expect(debug?.spatialCandidates ?? Infinity).toBeLessThan(fixture.activeTripCount);
  expect(debug?.visitedSpatialBuckets ?? Infinity).toBeLessThan(debug?.totalSpatialBuckets ?? 0);

  const initialReuse = debug?.poolReuseCount ?? 0;
  await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: { focusCell(x: number, z: number): void };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    api?.focusCell(112, 100);
  });
  await page.waitForTimeout(250);
  await page.evaluate((focus) => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: { focusCell(x: number, z: number): void };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    api?.focusCell(focus.x, focus.z);
  }, fixture.focusCell);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (
          window as Window & {
            __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficApiSnapshot };
          }
        ).__WEB_THREE_CITY_TRAFFIC__;
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
  const finalSnapshot = await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficApiSnapshot };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    return api?.snapshot() ?? null;
  });
  const finalDebug = finalSnapshot?.presentation ?? null;
  await testInfo.attach('traffic-performance-measurements.json', {
    body: Buffer.from(
      JSON.stringify(
        {
          browser: testInfo.project.name,
          viewport: { width: 414, height: 896 },
          logicalCitizens: fixture.citizenCount,
          logicalActiveTrips: fixture.activeTripCount,
          debug: finalDebug,
          render: finalSnapshot?.render ?? null,
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

test('414x896 release Traffic frame floor holds for paused and x1 workloads', async ({
  browser,
}, testInfo) => {
  test.skip(
    process.env.WEB_THREE_CITY_PERFORMANCE_AUTHORITY !== 'metal',
    'The absolute frame floor is authoritative only on the explicitly selected Metal hardware renderer.',
  );
  test.setTimeout(600_000);
  const results: Array<Awaited<ReturnType<typeof sampleReleaseRun>>> = [];
  const runCount = Number(process.env.WEB_THREE_CITY_PERFORMANCE_RUNS ?? '3');
  const requestedMode = process.env.WEB_THREE_CITY_PERFORMANCE_MODE;
  const modes =
    requestedMode === undefined
      ? (['paused', 'x1'] as const)
      : requestedMode === 'paused' || requestedMode === 'x1'
        ? ([requestedMode] as const)
        : (() => {
            throw new Error(`unsupported Traffic performance mode: ${requestedMode}`);
          })();
  for (const mode of modes) {
    for (let run = 0; run < runCount; run += 1) {
      const context = await browser.newContext({
        baseURL: 'http://127.0.0.1:4174',
        viewport: { width: 414, height: 896 },
        deviceScaleFactor: 1,
      });
      try {
        results.push(await sampleReleaseRun(await context.newPage(), mode));
      } finally {
        await context.close();
      }
    }
  }

  await testInfo.attach('traffic-release-floor-results.json', {
    body: Buffer.from(
      `${JSON.stringify(
        {
          authority: 'Metal',
          viewport: { width: 414, height: 896 },
          logicalActiveTrips: 5_000,
          warmupFrames: 120,
          measuredFrames: 600,
          releaseFloorMs: 33.4,
          runs: results,
        },
        null,
        2,
      )}\n`,
    ),
    contentType: 'application/json',
  });
  console.log(
    `[traffic-release-floor][${process.env.WEB_THREE_CITY_ANGLE_BACKEND ?? 'default'}] ${JSON.stringify(
      results.map((result) => ({
        mode: result.mode,
        frame: result.frame,
        render: result.render,
        logicalActiveTrips: result.logicalActiveTrips,
        revisionDelta: result.revisionDelta,
        gameMinuteDelta: result.gameMinuteDelta,
      })),
    )}`,
  );

  for (const result of results) {
    expect(result.logicalActiveTrips).toBe(5_000);
    expect(result.render.calls).toBeGreaterThan(0);
    expect(result.render.triangles).toBeGreaterThan(0);
    expect(result.frame.p95, `${result.mode} p95`).toBeLessThanOrEqual(33.4);
    expect(result.frame.over100, `${result.mode} >100ms frames`).toBe(0);
    if (result.mode === 'paused') {
      expect(result.revisionDelta).toBe(0);
      expect(result.gameMinuteDelta).toBe(0);
    } else {
      expect(result.revisionDelta).toBeGreaterThan(0);
      expect(result.gameMinuteDelta).toBeGreaterThan(0);
    }
  }
});
