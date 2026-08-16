import { expect, test } from '@playwright/test';
import { openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import { GAME_URL, locateTerrainCell } from './helpers/interaction.js';

type RecoveryFixture = {
  citizenId: string;
  tripId: string;
  routeEdgeIds: string[];
  primaryRoadCutCell: { x: number; z: number };
};

type TrafficState = {
  citizenIds: string[];
  traffic: {
    graphSourceRoadRevision: number;
    activeTrips: Array<{
      tripId: string;
      citizenId: string;
      routeEdgeIds: string[];
      routeGraphRevision: number;
      status: string;
      failureReason: string | null;
    }>;
  };
};

test('bulldozing a future route edge recovers the active trip without orphaning its Citizen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
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
    const api = (window as Window & {
      __WEB_THREE_CITY_TRAFFIC__?: { installRoadRecoveryFixture(): RecoveryFixture };
    }).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.installRoadRecoveryFixture();
  });
  const before = await page.evaluate(() => {
    const api = (window as Window & {
      __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficState };
    }).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.snapshot();
  });
  expect(before.traffic.activeTrips).toHaveLength(1);
  expect(before.traffic.activeTrips[0]?.tripId).toBe(fixture.tripId);

  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Bulldoze Road', exact: true }).click();
  const point = await locateTerrainCell(page, fixture.primaryRoadCutCell);
  await page.mouse.click(point.x, point.y);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = (window as Window & {
          __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficState };
        }).__WEB_THREE_CITY_TRAFFIC__;
        return api?.snapshot().traffic.graphSourceRoadRevision ?? -1;
      }),
    )
    .toBeGreaterThan(before.traffic.graphSourceRoadRevision);

  const after = await page.evaluate(() => {
    const api = (window as Window & {
      __WEB_THREE_CITY_TRAFFIC__?: { snapshot(): TrafficState };
    }).__WEB_THREE_CITY_TRAFFIC__;
    if (api === undefined) throw new Error('traffic test API unavailable');
    return api.snapshot();
  });
  const trip = after.traffic.activeTrips.find((candidate) => candidate.tripId === fixture.tripId);
  expect(trip).toBeTruthy();
  expect(trip?.citizenId).toBe(fixture.citizenId);
  expect(after.citizenIds).toContain(fixture.citizenId);
  expect(trip?.status).toBe('Active');
  expect(trip?.routeEdgeIds).not.toEqual(fixture.routeEdgeIds);
  expect(trip?.routeGraphRevision).toBe(after.traffic.graphSourceRoadRevision);
});
