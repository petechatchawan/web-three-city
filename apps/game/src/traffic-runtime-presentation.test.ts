import { createSimulationSnapshot } from '@web-three-city/simulation-core';
import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { createPresentCitizenMobilityProjection } from './mobility-source-projection.js';
import {
  isTrafficJourneyDepartureReceipt,
  planMobilityTrafficTick,
} from './mobility-traffic-tick.js';
import { TrafficRuntimePresentation } from './traffic-runtime-presentation.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from './traffic-source-projection.js';
import { createTrafficReleaseFixture } from './traffic-release-fixture.js';

describe('Traffic runtime presentation', () => {
  it('materializes presentation-only replays for committed journeys that finish within one logical tick', () => {
    const fixture = createTrafficReleaseFixture();
    const world = fixture.world;
    const commute = planMobilityTrafficTick({
      mobilityBefore: world.mobility,
      trafficBefore: world.traffic,
      citizensAfter: createPresentCitizenMobilityProjection(world.rci, world.buildings, 9),
      simulationBefore: world.simulation,
      simulationAfter: createSimulationSnapshot({
        revision: world.simulation.revision + 3,
        absoluteTick: 9,
        growthSequence: world.simulation.growthSequence,
      }),
      trafficSource: {
        roads: createRoadTrafficSourceProjectionFromEnvironment(
          world.roads,
          world.environments.building,
        ),
        buildingAccess: createBuildingTrafficAccessProjection(
          world.buildings,
          world.roads,
          world.environments.building,
        ),
      },
    });
    expect(commute.traffic.activeTrips).toHaveLength(0);
    const departures = commute.trafficReceipts.filter(isTrafficJourneyDepartureReceipt);
    expect(departures).toHaveLength(fixture.summary.citizenIds.length);

    const scene = new Scene();
    const presentation = new TrafficRuntimePresentation(scene);
    presentation.synchronize(world);
    presentation.enqueueJourneyReceipts(world, departures, 1_000);
    presentation.frame(1_500);

    const debug = presentation.debugSnapshot();
    expect(debug.logicalActiveTrips).toBe(0);
    expect(debug.journeyReplayCount).toBe(fixture.summary.citizenIds.length);
    expect(debug.journeyReplayPedestrians).toBe(fixture.summary.walkCitizenIds.length);
    expect(debug.journeyReplayVehicles).toBe(fixture.summary.driveCitizenIds.length);
    expect(debug.visiblePedestrians).toBe(fixture.summary.walkCitizenIds.length);
    expect(debug.visibleVehicles).toBe(fixture.summary.driveCitizenIds.length);
    expect((debug as unknown as Record<string, number>).lastFrameTimestampMs).toBe(1_500);

    presentation.frame(20_000);
    expect(presentation.debugSnapshot().journeyReplayCount).toBe(0);
    presentation.dispose();
  });
});
