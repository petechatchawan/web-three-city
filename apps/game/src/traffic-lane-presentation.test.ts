import type {
  BuildingTrafficAccessProjection,
  RoadTrafficSourceProjection,
} from '@web-three-city/traffic-core';
import { describe, expect, it } from 'vitest';
import { createTrafficPresentationRouteSegments } from './traffic-presentation-projection.js';

const EAST = 1 << 1;
const WEST = 1 << 3;

const BUILDING_ACCESS: BuildingTrafficAccessProjection = Object.freeze({
  buildingRevision: 1,
  accesses: Object.freeze([]),
});

function twoCellRoad(definitionCode: number): RoadTrafficSourceProjection {
  return Object.freeze({
    roadRevision: definitionCode,
    width: 128,
    height: 128,
    cells: Object.freeze([
      Object.freeze({
        x: 1,
        z: 1,
        definitionCode,
        connectionMask: EAST,
        elevationStartQ: 0,
        elevationEndQ: 0,
      }),
      Object.freeze({
        x: 2,
        z: 1,
        definitionCode,
        connectionMask: WEST,
        elevationStartQ: 0,
        elevationEndQ: 0,
      }),
    ]),
  });
}

describe('PR3 Game Traffic lane presentation', () => {
  it('projects opposing Drive trips onto opposite left-hand lane centerlines', () => {
    const roads = twoCellRoad(1);
    const eastbound = createTrafficPresentationRouteSegments({
      roads,
      buildingAccess: BUILDING_ACCESS,
      mode: 'Drive',
      routeEdgeIds: ['drive:1,1->2,1'],
    });
    const westbound = createTrafficPresentationRouteSegments({
      roads,
      buildingAccess: BUILDING_ACCESS,
      mode: 'Drive',
      routeEdgeIds: ['drive:2,1->1,1'],
    });

    expect(eastbound).toHaveLength(1);
    expect(westbound).toHaveLength(1);
    expect(eastbound[0]!.from.zQ).toBe(eastbound[0]!.to.zQ);
    expect(westbound[0]!.from.zQ).toBe(westbound[0]!.to.zQ);
    expect(westbound[0]!.from.zQ - eastbound[0]!.from.zQ).toBe(360);
  });

  it('changes lane geometry when a Road upgrades while preserving canonical edge identity', () => {
    const local = createTrafficPresentationRouteSegments({
      roads: twoCellRoad(1),
      buildingAccess: BUILDING_ACCESS,
      mode: 'Drive',
      routeEdgeIds: ['drive:1,1->2,1'],
    });
    const arterial = createTrafficPresentationRouteSegments({
      roads: twoCellRoad(3),
      buildingAccess: BUILDING_ACCESS,
      mode: 'Drive',
      routeEdgeIds: ['drive:1,1->2,1'],
    });

    expect(local[0]!.edgeId).toBe(arterial[0]!.edgeId);
    expect(arterial[0]!.from.zQ).toBe(local[0]!.from.zQ - 50);
    expect(arterial[0]!.to.zQ).toBe(local[0]!.to.zQ - 50);
  });
});
