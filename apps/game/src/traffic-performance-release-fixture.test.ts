import {
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
} from '@web-three-city/traffic-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createCommittedWorldFromDomainState } from './application/committed-world.js';
import { createTrafficModeGraphProvider } from './traffic-mode-graph-provider.js';
import { createTrafficPresentationSnapshot } from './traffic-presentation-projection.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from './traffic-source-projection.js';
import { createTrafficPerformanceReleaseFixture } from './traffic-performance-release-fixture.js';
import { decodeWorldSave } from './world-save.js';

describe('Traffic performance release fixture', () => {
  it('keeps every seeded trip on a connected route with enough lifetime for x1 sampling', () => {
    const fixture = createTrafficPerformanceReleaseFixture();
    const decoded = decodeWorldSave(fixture.save, WORLD_CONFIG);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const world = createCommittedWorldFromDomainState({ revision: 0, ...decoded.value });
    const source = createRoadTrafficSourceProjectionFromEnvironment(
      world.roads,
      world.environments.building,
    );
    const access = createBuildingTrafficAccessProjection(
      world.buildings,
      world.roads,
      world.environments.building,
    );
    const walk = derivePedestrianTrafficGraph(source);
    const drive = deriveVehicleTrafficGraph(source);
    const trafficGraphs = createTrafficModeGraphProvider().get(source, world.buildings.revision);
    const presentation = createTrafficPresentationSnapshot({
      traffic: world.traffic,
      roads: source,
      buildingAccess: access,
      trafficGraphs,
      includeTrafficFlow: false,
    });

    for (const trip of world.traffic.activeTrips) {
      expect(trip.routeEdgeIds.length).toBeGreaterThanOrEqual(82);
      const graph = trip.mode === 'Walk' ? walk : drive;
      const edgeById = new Map(graph.edges.map((edge) => [edge.edgeId, edge] as const));
      for (let index = 1; index < trip.routeEdgeIds.length; index += 1) {
        expect(edgeById.get(trip.routeEdgeIds[index - 1]!)?.toNodeId).toBe(
          edgeById.get(trip.routeEdgeIds[index]!)?.fromNodeId,
        );
      }
      expect(trip.routeGraphRevision).toBe(world.roads.revision);
    }

    expect(access.accesses.length).toBeGreaterThan(0);
    expect(world.traffic.activeTrips).toHaveLength(fixture.activeTripCount);
    expect(presentation.agents).toHaveLength(fixture.activeTripCount);

    const oneTripTraffic = Object.freeze({
      ...world.traffic,
      activeTrips: Object.freeze([world.traffic.activeTrips[0]!]),
    });
    const flowProjection = createTrafficPresentationSnapshot({
      traffic: oneTripTraffic,
      roads: source,
      buildingAccess: access,
      trafficGraphs,
    });
    const presentationOnlyProjection = createTrafficPresentationSnapshot({
      traffic: oneTripTraffic,
      roads: source,
      buildingAccess: access,
      trafficGraphs,
      includeTrafficFlow: false,
    });
    expect(presentationOnlyProjection.agents).toEqual(flowProjection.agents);
    expect(presentationOnlyProjection.edges).toEqual([]);
    expect(flowProjection.edges.length).toBeGreaterThan(0);
  }, 120_000);
});
