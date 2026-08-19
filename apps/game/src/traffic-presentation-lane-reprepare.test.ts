import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { TrafficPresentation } from './traffic-presentation.js';
import type { TrafficPresentationSnapshot } from './traffic-presentation-projection.js';

function driveSnapshot(
  trafficRevision: number,
  laneZQ: number,
): TrafficPresentationSnapshot {
  return Object.freeze({
    trafficRevision,
    edges: Object.freeze([]),
    agents: Object.freeze([
      Object.freeze({
        tripId: 'drive-trip',
        citizenId: 'citizen-drive',
        mode: 'Drive' as const,
        routeEdgeId: 'drive-edge',
        progressQ: 500_000,
        queued: false,
        from: Object.freeze({ xQ: 0, yQ: 0, zQ: laneZQ }),
        to: Object.freeze({ xQ: 8_000, yQ: 0, zQ: laneZQ }),
        turn: null,
        routeSegments: Object.freeze([
          Object.freeze({
            edgeId: 'drive-edge',
            from: Object.freeze({ xQ: 0, yQ: 0, zQ: laneZQ }),
            to: Object.freeze({ xQ: 8_000, yQ: 0, zQ: laneZQ }),
            lengthMillimeters: 8_000,
          }),
        ]),
        routeDistanceMillimeters: 4_000,
      }),
    ]),
  });
}

describe('PR3 Traffic presentation lane route reconciliation', () => {
  it('re-prepares an active trip when lane geometry changes without changing trip identity', () => {
    const scene = new Scene();
    const presentation = new TrafficPresentation(scene);
    const local = driveSnapshot(7, -180);
    presentation.update(local, { x: 4, z: 0 }, 0, 0);
    const before = presentation.debugSnapshot();

    const upgraded = driveSnapshot(8, -230);
    presentation.update(upgraded, { x: 4, z: 0 }, 1, 1_000);
    const after = presentation.debugSnapshot();

    expect(before.preparedRouteCount).toBe(1);
    expect(after.preparedRouteCount).toBe(2);
    expect(after.visibleVehicles).toBe(1);
    expect(upgraded.agents[0]!.tripId).toBe('drive-trip');
    presentation.dispose();
  });
});
