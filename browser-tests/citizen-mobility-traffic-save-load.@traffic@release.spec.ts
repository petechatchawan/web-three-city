import { expect, test } from '@playwright/test';

const SAVE_KEY = 'web-three-city:world-save:v7';

type Snapshot = {
  absoluteTick: number;
  citizenIds: string[];
  mobility: unknown;
  traffic: unknown;
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
  for (let index = 0; index < count; index += 1) {
    expect(
      await page.evaluate(() => {
        const api = (window as Window & { __WEB_THREE_CITY_TIME__?: { step(): boolean } })
          .__WEB_THREE_CITY_TIME__;
        if (api === undefined) throw new Error('time test API unavailable');
        return api.step();
      }),
    ).toBe(true);
  }
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

test('WorldSaveV7 restores Mobility/Traffic authority and continues deterministic commute', async ({
  page,
}) => {
  await bootFixture(page);
  await step(page, 2);
  const beforeSave = await snapshot(page);
  expect(beforeSave.absoluteTick).toBe(8);

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
    schemaVersion: 7,
    mobility: { kind: 'mobility-save', schemaVersion: 1 },
    traffic: { kind: 'traffic-save', schemaVersion: 1 },
  });

  await step(page, 3);
  expect((await snapshot(page)).absoluteTick).toBe(11);
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
  expect(restored.absoluteTick).toBe(beforeSave.absoluteTick);
  expect(restored.citizenIds).toEqual(beforeSave.citizenIds);
  expect(restored.mobility).toEqual(beforeSave.mobility);
  expect(restored.traffic).toEqual(beforeSave.traffic);

  await step(page, 9);
  const finished = await snapshot(page);
  expect(finished.absoluteTick).toBe(17);
  const mobility = finished.mobility as {
    trips: Array<{ status: string }>;
    citizenStates: Array<{ currentActivity: string }>;
  };
  expect(mobility.trips).toHaveLength(finished.citizenIds.length * 2);
  expect(mobility.trips.every((trip) => trip.status === 'Arrived')).toBe(true);
  expect(mobility.citizenStates.every((citizen) => citizen.currentActivity === 'Home')).toBe(true);
});
