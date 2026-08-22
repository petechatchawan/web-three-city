import { expect, test } from '@playwright/test';

type TrafficSnapshot = {
  worldRevision: number;
  absoluteGameMinute: number;
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
  traffic: {
    timeCursor: {
      sourceGameMinute: number;
      completedTransportQuantaWithinMinute: number;
      absoluteTransportSecond: number;
      temporalPolicyVersion: number;
    };
    activeTrips: Array<{
      tripId: string;
      citizenId: string;
      mode: 'Walk' | 'Drive';
      status: 'Active' | 'Arrived' | 'Failed' | 'Cancelled';
      driveMovementPhase: 'WaitingForEntry' | 'Entering' | 'Travelling' | 'Leaving' | null;
    }>;
    queuedResourceSummaries: Array<{ resourceId: string; tripIds: string[] }>;
    reservedResourceSummaries: Array<{ resourceId: string; tripId: string }>;
  };
  presentation: {
    visiblePedestrians: number;
    visibleVehicles: number;
    materializedTripIds: string[];
    replayCount?: number;
    canonicalActiveDrives: Array<{
      tripId: string;
      driveMovementPhase: string;
      reservationResourceIds: string[];
    }>;
  } | null;
};

type FixtureSummary = {
  startAbsoluteGameMinute: number;
  departureGameMinutes: Record<string, number>;
  citizenIds: string[];
  walkCitizenIds: string[];
  driveCitizenIds: string[];
};

function canonicalCitizenIds(ids: readonly string[]): string[] {
  return [...ids].sort((first, second) => first.localeCompare(second));
}

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
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: { installReleaseFixture(): FixtureSummary };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.installReleaseFixture();
  });
}

async function step(page: import('@playwright/test').Page, count = 1): Promise<void> {
  const advanced = await page.evaluate((steps) => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TIME__?: { step(): boolean };
      }
    ).__WEB_THREE_CITY_TIME__;
    if (api === undefined) throw new Error('time test API unavailable');
    for (let index = 0; index < steps; index += 1) {
      if (!api.step()) return false;
    }
    return true;
  }, count);
  expect(advanced).toBe(true);
}

async function trafficSnapshot(page: import('@playwright/test').Page): Promise<TrafficSnapshot> {
  return page.evaluate(() => {
    const api = (
      window as Window & {
        __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficSnapshot };
      }
    ).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.snapshot();
  });
}

test.describe('Citizen commute browser acceptance', () => {
  test('morning commute exposes only authoritative lifecycle and materialization facts', async ({
    page,
  }, testInfo) => {
    const fixture = await installFixture(page);
    expect(fixture.startAbsoluteGameMinute).toBe(540);
    await step(page, 1);

    const state = await trafficSnapshot(page);
    expect(state.absoluteGameMinute).toBeGreaterThan(fixture.startAbsoluteGameMinute);
    expect(state.traffic.timeCursor.sourceGameMinute).toBe(state.absoluteGameMinute);
    expect(state.traffic.timeCursor.completedTransportQuantaWithinMinute).toBeGreaterThanOrEqual(0);
    expect(state.traffic.timeCursor.absoluteTransportSecond).toBeGreaterThan(0);
    expect(state.traffic.timeCursor.temporalPolicyVersion).toBeGreaterThan(0);
    expect(canonicalCitizenIds(state.citizenIds)).toEqual(canonicalCitizenIds(fixture.citizenIds));
    expect(state.mobility.trips.every((trip) => fixture.citizenIds.includes(trip.citizenId))).toBe(
      true,
    );

    const modeByCitizen = new Map(state.mobility.trips.map((trip) => [trip.citizenId, trip.mode]));
    for (const citizenId of fixture.walkCitizenIds)
      expect(modeByCitizen.get(citizenId)).toBe('Walk');
    for (const citizenId of fixture.driveCitizenIds)
      expect(modeByCitizen.get(citizenId)).toBe('Drive');

    const activeTripIds = state.traffic.activeTrips.map((trip) => trip.tripId);
    expect(new Set(activeTripIds).size).toBe(activeTripIds.length);
    expect(
      state.traffic.activeTrips.every(
        (trip) =>
          trip.status === 'Active' &&
          (trip.mode === 'Walk'
            ? trip.driveMovementPhase === null
            : trip.driveMovementPhase !== null),
      ),
    ).toBe(true);
    expect(
      state.presentation?.materializedTripIds.every((tripId) => activeTripIds.includes(tripId)),
    ).toBe(true);
    expect(state.presentation?.replayCount ?? 0).toBe(0);
    expect(state.presentation?.visiblePedestrians ?? 0).toBeLessThanOrEqual(300);
    expect(state.presentation?.visibleVehicles ?? 0).toBeLessThanOrEqual(300);
    expect(
      (state.presentation?.visiblePedestrians ?? 0) + (state.presentation?.visibleVehicles ?? 0),
    ).toBeLessThanOrEqual(500);

    await page.screenshot({
      path: testInfo.outputPath('traffic-motion-realism-mobile.png'),
      fullPage: true,
    });
  });
});
