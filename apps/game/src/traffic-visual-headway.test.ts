import {
  FOUNDATION_TRAFFIC_PRESENTATION_POLICY,
  FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY,
} from '@web-three-city/traffic-three';
import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { TrafficPresentation } from './traffic-presentation.js';
import type { TrafficPresentationSnapshot } from './traffic-presentation-projection.js';

function dynamicHeadwaySnapshot(
  trafficRevision: number,
  leaderDistanceMillimeters: number,
  followerDistanceMillimeters: number,
): TrafficPresentationSnapshot {
  const shared = Object.freeze({
    edgeId: 'drive:shared',
    from: Object.freeze({ xQ: 0, yQ: 0, zQ: 0 }),
    to: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 0 }),
    lengthMillimeters: 8_000,
    movementKind: 'straight' as const,
  });
  const leaderTurn = Object.freeze({
    edgeId: 'drive:leader-turn',
    from: shared.to,
    to: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 8_000 }),
    lengthMillimeters: 8_000,
    movementKind: 'turn-right' as const,
  });
  const followerStraight = Object.freeze({
    edgeId: 'drive:follower-straight',
    from: shared.to,
    to: Object.freeze({ xQ: 16_000, yQ: 0, zQ: 0 }),
    lengthMillimeters: 8_000,
    movementKind: 'straight' as const,
  });

  const progressFor = (distanceMillimeters: number) =>
    Math.min(1_000_000, Math.floor((distanceMillimeters * 1_000_000) / 8_000));

  return Object.freeze({
    trafficRevision,
    edges: Object.freeze([]),
    agents: Object.freeze([
      Object.freeze({
        tripId: 'leader',
        citizenId: 'citizen-leader',
        mode: 'Drive' as const,
        routeEdgeId: shared.edgeId,
        progressQ: progressFor(leaderDistanceMillimeters),
        queued: false,
        from: shared.from,
        to: shared.to,
        turn: null,
        routeSegments: Object.freeze([shared, leaderTurn]),
        routeDistanceMillimeters: leaderDistanceMillimeters,
      }),
      Object.freeze({
        tripId: 'follower',
        citizenId: 'citizen-follower',
        mode: 'Drive' as const,
        routeEdgeId: shared.edgeId,
        progressQ: progressFor(followerDistanceMillimeters),
        queued: false,
        from: shared.from,
        to: shared.to,
        turn: null,
        routeSegments: Object.freeze([shared, followerStraight]),
        routeDistanceMillimeters: followerDistanceMillimeters,
      }),
    ]),
  });
}

describe('TrafficPresentation dynamic visual headway', () => {
  it('keeps rendered vehicle bodies separated when the leader slows for a turn', () => {
    const scene = new Scene();
    const presentation = new TrafficPresentation(scene);
    const minimumHeadway =
      FOUNDATION_TRAFFIC_PRESENTATION_POLICY.vehicleMinimumHeadwayMillimeters;
    const maximumVehicleBodyLength =
      FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY.vehicleLengthWorldUnits *
      (1 + FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY.appearanceScaleVariation) *
      1_000;

    presentation.update(dynamicHeadwaySnapshot(1, 5_000, 4_350), { x: 6, z: 0 }, 0, 0);
    presentation.update(dynamicHeadwaySnapshot(2, 7_500, 6_850), { x: 6, z: 0 }, 1, 1_000);

    expect(7_500 - 6_850).toBe(minimumHeadway);
    let minimumObservedSeparation = Number.POSITIVE_INFINITY;
    const root = scene.getObjectByName('traffic-vehicle-root')!;

    for (let timestampMs = 1_016; timestampMs <= 2_400; timestampMs += 16) {
      presentation.frame(timestampMs);
      const leader = root.children.find((child) => child.userData.tripId === 'leader');
      const follower = root.children.find((child) => child.userData.tripId === 'follower');
      expect(leader).toBeTruthy();
      expect(follower).toBeTruthy();
      const separationMillimeters =
        Math.hypot(
          leader!.position.x - follower!.position.x,
          leader!.position.z - follower!.position.z,
        ) * 1_000;
      minimumObservedSeparation = Math.min(minimumObservedSeparation, separationMillimeters);
    }

    expect(minimumObservedSeparation).toBeGreaterThanOrEqual(maximumVehicleBodyLength);
    presentation.dispose();
  });
});
