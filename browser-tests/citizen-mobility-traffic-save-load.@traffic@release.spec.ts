import { expect, test } from '@playwright/test';

const SAVE_KEY = 'web-three-city:world-save:v8';

type Snapshot = {
  absoluteGameMinute: number;
  citizenIds: string[];
  mobility: { trips: Array<{ tripId: string }> };
  traffic: {
    timeCursor: unknown;
    activeTrips: Array<{
      tripId: string;
      driveMovementPhase: string | null;
      queuedResourceIds: string[];
      reservedResourceIds: string[];
    }>;
    queuedResourceSummaries: unknown[];
    reservedResourceSummaries: unknown[];
  };
  presentation: { materializedTripIds: string[]; replayCount?: number } | null;
};

async function bootFixture(page: import('@playwright/test').Page): Promise<void> {
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
  await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: { installReleaseFixture(): unknown };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    api.installReleaseFixture();
  });
}

async function step(page: import('@playwright/test').Page, count: number): Promise<void> {
  const advanced = await page.evaluate((steps) => {
    const api = (window as Window & { __WEB_THREE_CITY_TIME__?: { step(): boolean } })
      .__WEB_THREE_CITY_TIME__;
    if (api === undefined) throw new Error('time test API unavailable');
    for (let index = 0; index < steps; index += 1) {
      if (!api.step()) return false;
    }
    return true;
  }, count);
  expect(advanced).toBe(true);
}

async function snapshot(page: import('@playwright/test').Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): Snapshot };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.snapshot();
  });
}

test('WorldSaveV8 restores calendar, cursor, lifecycle, and reservation authority exactly', async ({
  page,
}) => {
  await bootFixture(page);
  await step(page, 1);
  const beforeSave = await snapshot(page);
  expect(beforeSave.absoluteGameMinute).toBeGreaterThan(540);
  expect(beforeSave.presentation?.replayCount ?? 0).toBe(0);

  await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: { saveWorld(): void };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    api.saveWorld();
  });
  const persisted = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  expect(persisted).not.toBeNull();
  expect(JSON.parse(persisted ?? '{}')).toMatchObject({
    kind: 'world-save',
    schemaVersion: 8,
    mobility: { schemaVersion: 2 },
    traffic: { schemaVersion: 2 },
  });

  await step(page, 3);
  expect((await snapshot(page)).absoluteGameMinute).toBeGreaterThan(beforeSave.absoluteGameMinute);
  await page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: { loadWorld(): void };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    api.loadWorld();
  });
  const restored = await snapshot(page);
  expect(restored.absoluteGameMinute).toBe(beforeSave.absoluteGameMinute);
  expect(restored.citizenIds).toEqual(beforeSave.citizenIds);
  expect(restored.mobility).toEqual(beforeSave.mobility);
  expect(restored.traffic).toEqual(beforeSave.traffic);
  const restoredActiveTripIds = new Set(restored.traffic.activeTrips.map((trip) => trip.tripId));
  expect(
    restored.presentation?.materializedTripIds.every((tripId) => restoredActiveTripIds.has(tripId)),
  ).toBe(true);
  expect(restored.presentation?.replayCount ?? 0).toBe(0);

  await step(page, 1);
  const finished = await snapshot(page);
  expect(finished.absoluteGameMinute).toBeGreaterThan(restored.absoluteGameMinute);
  expect(finished.traffic.timeCursor).not.toEqual(restored.traffic.timeCursor);
  const mobilityTripIds = new Set(finished.mobility.trips.map((trip) => trip.tripId));
  expect(finished.traffic.activeTrips.every((trip) => mobilityTripIds.has(trip.tripId))).toBe(true);
});
