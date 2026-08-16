import { expect, test } from '@playwright/test';

type TrafficSnapshot = {
  worldRevision: number;
  absoluteTick: number;
  citizenIds: string[];
  mobility: {
    citizenStates: Array<{
      citizenId: string;
      currentActivity: string;
      stationaryBuildingId: string | null;
      activeTripId: string | null;
    }>;
    trips: Array<{
      tripId: string;
      citizenId: string;
      mode: 'Walk' | 'Drive' | null;
      purpose: string;
      status: string;
    }>;
  };
  traffic: { activeTrips: Array<{ tripId: string; citizenId: string; mode: 'Walk' | 'Drive' }> };
  presentation: {
    visiblePedestrians: number;
    visibleVehicles: number;
    journeyReplayCount: number;
    journeyReplayPedestrians: number;
    journeyReplayVehicles: number;
  } | null;
};

type FixtureSummary = {
  startAbsoluteTick: number;
  citizenIds: string[];
  walkCitizenIds: string[];
  driveCitizenIds: string[];
};

async function installFixture(page: import('@playwright/test').Page): Promise<FixtureSummary> {
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
  return page.evaluate(() => {
    const api = (window as Window & {
      __WEB_THREE_CITY_TRAFFIC__?: { installReleaseFixture(): FixtureSummary };
    }).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.installReleaseFixture();
  });
}

async function step(page: import('@playwright/test').Page, count = 1): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const advanced = await page.evaluate(() => {
      const api = (window as Window & {
        __WEB_THREE_CITY_TIME__?: { step(): boolean };
      }).__WEB_THREE_CITY_TIME__;
      if (api === undefined) throw new Error('time test API unavailable');
      return api.step();
    });
    expect(advanced).toBe(true);
  }
}

async function trafficSnapshot(page: import('@playwright/test').Page): Promise<TrafficSnapshot> {
  return page.evaluate(() => {
    const api = (window as Window & {
      __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficSnapshot };
    }).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.snapshot();
  });
}

test.describe('Citizen commute browser acceptance', () => {
  test('morning commute uses real Citizens, deterministic Walk/Drive choice, and visible Three.js agents', async ({
    page,
  }) => {
    const fixture = await installFixture(page);
    expect(fixture.startAbsoluteTick).toBe(6);
    await step(page, 2);

    await expect
      .poll(async () => (await trafficSnapshot(page)).presentation?.journeyReplayCount ?? 0)
      .toBeGreaterThan(0);
    const state = await trafficSnapshot(page);
    expect(state.absoluteTick).toBe(8);
    expect(state.citizenIds).toEqual(fixture.citizenIds);
    expect(state.mobility.trips).toHaveLength(fixture.citizenIds.length);
    expect(state.mobility.trips.every((trip) => fixture.citizenIds.includes(trip.citizenId))).toBe(true);

    const modeByCitizen = new Map(state.mobility.trips.map((trip) => [trip.citizenId, trip.mode]));
    for (const citizenId of fixture.walkCitizenIds) expect(modeByCitizen.get(citizenId)).toBe('Walk');
    for (const citizenId of fixture.driveCitizenIds) expect(modeByCitizen.get(citizenId)).toBe('Drive');

    expect(state.presentation?.journeyReplayPedestrians).toBe(fixture.walkCitizenIds.length);
    expect(state.presentation?.journeyReplayVehicles).toBe(fixture.driveCitizenIds.length);
    expect(state.presentation?.visiblePedestrians ?? 0).toBeLessThanOrEqual(300);
    expect(state.presentation?.visibleVehicles ?? 0).toBeLessThanOrEqual(300);
    expect(
      (state.presentation?.visiblePedestrians ?? 0) + (state.presentation?.visibleVehicles ?? 0),
    ).toBeLessThanOrEqual(500);
  });

  test('evening commute returns the same real Citizens Home without creating synthetic citizens', async ({
    page,
  }) => {
    const fixture = await installFixture(page);
    await step(page, 11);
    await expect
      .poll(async () => (await trafficSnapshot(page)).presentation?.journeyReplayCount ?? 0)
      .toBeGreaterThan(0);

    const state = await trafficSnapshot(page);
    expect(state.absoluteTick).toBe(17);
    expect(state.citizenIds).toEqual(fixture.citizenIds);
    expect(state.mobility.trips).toHaveLength(fixture.citizenIds.length * 2);
    expect(state.mobility.citizenStates.every((citizen) => citizen.currentActivity === 'Home')).toBe(
      true,
    );
    expect(new Set(state.mobility.trips.map((trip) => trip.citizenId))).toEqual(
      new Set(fixture.citizenIds),
    );
  });
});
