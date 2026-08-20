import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { FOUNDATION_TRAFFIC_PRESENTATION_POLICY } from '@web-three-city/traffic-three';
import { TrafficPresentation } from './traffic-presentation.js';
import type { TrafficPresentationSnapshot } from './traffic-presentation-projection.js';

function crossEdgeSnapshot(): TrafficPresentationSnapshot {
  const first = Object.freeze({
    edgeId: 'drive:0,0->1,0',
    from: Object.freeze({ xQ: 0, yQ: 0, zQ: 0 }),
    to: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 0 }),
    lengthMillimeters: 8_000,
  });
  const second = Object.freeze({
    edgeId: 'drive:1,0->2,0',
    from: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 0 }),
    to: Object.freeze({ xQ: 16_000, yQ: 0, zQ: 0 }),
    lengthMillimeters: 8_000,
  });
  const route = Object.freeze([first, second]);

  return Object.freeze({
    trafficRevision: 1,
    edges: Object.freeze([]),
    agents: Object.freeze([
      Object.freeze({
        tripId: 'leader',
        citizenId: 'citizen-leader',
        mode: 'Drive' as const,
        routeEdgeId: second.edgeId,
        progressQ: 12_500,
        queued: false,
        from: second.from,
        to: second.to,
        turn: null,
        routeSegments: route,
        routeDistanceMillimeters: 8_100,
      }),
      Object.freeze({
        tripId: 'follower',
        citizenId: 'citizen-follower',
        mode: 'Drive' as const,
        routeEdgeId: first.edgeId,
        progressQ: 987_500,
        queued: false,
        from: first.from,
        to: first.to,
        turn: null,
        routeSegments: route,
        routeDistanceMillimeters: 7_900,
      }),
    ]),
  });
}

describe('TrafficPresentation route-aware vehicle headway', () => {
  it('keeps minimum visual headway when cars straddle adjacent canonical Road edges', () => {
    const scene = new Scene();
    const presentation = new TrafficPresentation(scene);
    presentation.update(crossEdgeSnapshot(), { x: 8, z: 0 }, 0, 0);

    const root = scene.getObjectByName('traffic-vehicle-root')!;
    const leader = root.children.find((child) => child.userData.tripId === 'leader');
    const follower = root.children.find((child) => child.userData.tripId === 'follower');
    expect(leader).toBeTruthy();
    expect(follower).toBeTruthy();

    const actualHeadwayMillimeters = (leader!.position.x - follower!.position.x) * 1_000;
    expect(actualHeadwayMillimeters).toBeGreaterThanOrEqual(
      FOUNDATION_TRAFFIC_PRESENTATION_POLICY.vehicleMinimumHeadwayMillimeters,
    );
    presentation.dispose();
  });
});
