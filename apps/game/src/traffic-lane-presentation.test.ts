import type {
  BuildingTrafficAccessProjection,
  RoadTrafficSourceProjection,
} from '@web-three-city/traffic-core';
import { describe, expect, it } from 'vitest';
import { createTrafficPresentationRouteSegments } from './traffic-presentation-projection.js';

const NORTH = 1 << 0;
const EAST = 1 << 1;
const SOUTH = 1 << 2;
const WEST = 1 << 3;

const BUILDING_ACCESS: BuildingTrafficAccessProjection = Object.freeze({
  buildingRevision: 1,
  accesses: Object.freeze([]),
});

interface MotionRouteSegmentView {
  readonly kind?: 'lane' | 'connector';
  readonly movementKind?: 'straight' | 'turn-left' | 'turn-right';
  readonly curve?: unknown;
}

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

function cornerRoad(): RoadTrafficSourceProjection {
  return Object.freeze({
    roadRevision: 4,
    width: 128,
    height: 128,
    cells: Object.freeze([
      Object.freeze({
        x: 1,
        z: 1,
        definitionCode: 1,
        connectionMask: EAST,
        elevationStartQ: 0,
        elevationEndQ: 0,
      }),
      Object.freeze({
        x: 2,
        z: 1,
        definitionCode: 1,
        connectionMask: WEST | SOUTH,
        elevationStartQ: 0,
        elevationEndQ: 0,
      }),
      Object.freeze({
        x: 2,
        z: 2,
        definitionCode: 1,
        connectionMask: NORTH,
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

  it('preserves cubic connector metadata for continuous Game vehicle turns', () => {
    const segments = createTrafficPresentationRouteSegments({
      roads: cornerRoad(),
      buildingAccess: BUILDING_ACCESS,
      mode: 'Drive',
      routeEdgeIds: ['drive:1,1->2,1', 'drive:2,1->2,2'],
    }) as readonly (ReturnType<typeof createTrafficPresentationRouteSegments>[number] &
      MotionRouteSegmentView)[];

    const connectors = segments.filter((segment) => segment.kind === 'connector');
    expect(connectors).toHaveLength(2);
    expect(connectors.map((segment) => segment.movementKind)).toEqual(['turn-right', 'turn-right']);
    expect(connectors.every((segment) => segment.curve !== undefined)).toBe(true);
  });

  it('changes presentation lane geometry on Road upgrade while preserving canonical source edge identity', () => {
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

    expect(local[0]!.sourceEdgeId).toBe('drive:1,1->2,1');
    expect(arterial[0]!.sourceEdgeId).toBe('drive:1,1->2,1');
    expect(local[0]!.edgeId).not.toBe(arterial[0]!.edgeId);
    expect(arterial[0]!.from.zQ).toBe(local[0]!.from.zQ - 50);
    expect(arterial[0]!.to.zQ).toBe(local[0]!.to.zQ - 50);
  });
});
