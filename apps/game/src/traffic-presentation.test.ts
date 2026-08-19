import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { TrafficPresentation } from './traffic-presentation.js';
import type { TrafficPresentationSnapshot } from './traffic-presentation-projection.js';

interface VehicleMotionDebugView {
  readonly visualDistanceMillimeters: number;
  readonly visualSpeedMillimetersPerSecond: number;
  readonly canonicalTargetDistanceMillimeters: number;
  readonly baselineFollowerSpeedMillimetersPerSecond: number;
}

function snapshot(): TrafficPresentationSnapshot {
  return Object.freeze({
    trafficRevision: 7,
    edges: Object.freeze([]),
    agents: Object.freeze([
      Object.freeze({
        tripId: 'walk-trip',
        citizenId: 'citizen-walk',
        mode: 'Walk' as const,
        routeEdgeId: 'walk-edge',
        progressQ: 500_000,
        queued: false,
        from: Object.freeze({ xQ: 0, yQ: 0, zQ: 0 }),
        to: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 0 }),
        turn: null,
        routeSegments: Object.freeze([
          Object.freeze({
            edgeId: 'walk-edge',
            from: Object.freeze({ xQ: 0, yQ: 0, zQ: 0 }),
            to: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 0 }),
            lengthMillimeters: 8_000,
          }),
        ]),
        routeDistanceMillimeters: 4_000,
      }),
      Object.freeze({
        tripId: 'drive-trip',
        citizenId: 'citizen-drive',
        mode: 'Drive' as const,
        routeEdgeId: 'drive-edge',
        progressQ: 500_000,
        queued: false,
        from: Object.freeze({ xQ: 0, yQ: 0, zQ: 8_000 }),
        to: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 8_000 }),
        turn: null,
        routeSegments: Object.freeze([
          Object.freeze({
            edgeId: 'drive-edge',
            from: Object.freeze({ xQ: 0, yQ: 0, zQ: 8_000 }),
            to: Object.freeze({ xQ: 8_000, yQ: 0, zQ: 8_000 }),
            lengthMillimeters: 8_000,
          }),
        ]),
        routeDistanceMillimeters: 4_000,
      }),
    ]),
  });
}

function withDriveDistance(
  source: TrafficPresentationSnapshot,
  trafficRevision: number,
  routeDistanceMillimeters: number,
): TrafficPresentationSnapshot {
  return Object.freeze({
    ...source,
    trafficRevision,
    agents: Object.freeze(
      source.agents.map((agent) =>
        agent.mode === 'Drive'
          ? Object.freeze({
              ...agent,
              progressQ: Math.min(1_000_000, routeDistanceMillimeters * 125),
              routeDistanceMillimeters,
            })
          : agent,
      ),
    ),
  });
}

function debugVehicleMotion(
  presentation: TrafficPresentation,
  tripId: string,
): VehicleMotionDebugView {
  const debug = Reflect.get(presentation, 'debugVehicleMotion') as unknown;
  expect(typeof debug).toBe('function');
  return (debug as (tripId: string) => VehicleMotionDebugView).call(presentation, tripId);
}

describe('TrafficPresentation real-agent contract', () => {
  it('materializes a real Walk trip and a real Drive trip into the shared Three.js scene', () => {
    const scene = new Scene();
    const presentation = new TrafficPresentation(scene);
    presentation.update(snapshot(), { x: 4, z: 4 }, 0);

    const debug = presentation.debugSnapshot();
    expect(debug.trafficRevision).toBe(7);
    expect(debug.logicalActiveTrips).toBe(2);
    expect(debug.visiblePedestrians).toBe(1);
    expect(debug.visibleVehicles).toBe(1);
    expect(scene.getObjectByName('traffic-pedestrian-root')).toBeTruthy();
    expect(scene.getObjectByName('traffic-vehicle-root')).toBeTruthy();

    expect(presentation.pickNearestAgent(4, 0, 1)).toEqual({
      kind: 'citizen',
      citizenId: 'citizen-walk',
      tripId: 'walk-trip',
    });
    expect(presentation.pickNearestAgent(4, 8, 1)).toEqual({
      kind: 'vehicle',
      citizenId: 'citizen-drive',
      tripId: 'drive-trip',
    });
    presentation.dispose();
  });

  it('keeps reconciliation and route preparation off the stable RAF hot path', () => {
    const scene = new Scene();
    const presentation = new TrafficPresentation(scene);
    const committed = snapshot();

    presentation.update(committed, { x: 4, z: 4 }, 0, 1_000);
    const warm = presentation.debugSnapshot();
    expect(warm.reconciliationCount).toBe(1);
    expect(warm.preparedRouteCount).toBe(2);

    for (let frameIndex = 1; frameIndex <= 120; frameIndex += 1) {
      presentation.update(committed, { x: 4, z: 4 }, frameIndex, 1_000 + frameIndex * 16);
    }

    const stable = presentation.debugSnapshot();
    expect(stable.reconciliationCount).toBe(1);
    expect(stable.frameSampleCount).toBe(121);
    expect(stable.preparedRouteCount).toBe(warm.preparedRouteCount);

    const target1x = withDriveDistance(committed, 8, 5_000);
    const target2x = withDriveDistance(target1x, 9, 6_000);
    const target4x = withDriveDistance(target2x, 10, 7_000);
    presentation.update(target1x, { x: 4, z: 4 }, 121, 3_000);
    presentation.update(target2x, { x: 4, z: 4 }, 122, 3_250);
    presentation.update(target4x, { x: 4, z: 4 }, 123, 3_375);

    const accelerated = presentation.debugSnapshot();
    expect(accelerated.reconciliationCount).toBe(4);
    expect(accelerated.frameSampleCount).toBe(124);
    expect(accelerated.preparedRouteCount).toBe(warm.preparedRouteCount);
    expect(accelerated.lastFrameTimestampMs).toBe(3_375);
    expect(committed.trafficRevision).toBe(7);
    expect(committed.agents[1]!.routeDistanceMillimeters).toBe(4_000);
    expect(committed.agents[1]!.progressQ).toBe(500_000);
    presentation.dispose();
  });

  it('dematerializes outside the camera bubble without mutating logical snapshot input', () => {
    const scene = new Scene();
    const presentation = new TrafficPresentation(scene);
    const committed = snapshot();
    presentation.update(committed, { x: 4, z: 4 }, 0);
    presentation.update(committed, { x: 10_000, z: 10_000 }, 1);

    expect(presentation.debugSnapshot().visiblePedestrians).toBe(0);
    expect(presentation.debugSnapshot().visibleVehicles).toBe(0);
    expect(committed.agents).toHaveLength(2);
    expect(committed.agents.map((agent) => agent.tripId)).toEqual(['walk-trip', 'drive-trip']);
    presentation.dispose();
  });

  it('accelerates and brakes Drive visuals through the presentation kinematics follower', () => {
    const scene = new Scene();
    const presentation = new TrafficPresentation(scene);
    const initial = snapshot();
    presentation.update(initial, { x: 4, z: 4 }, 0, 0);

    const next = withDriveDistance(initial, 8, 8_000);
    presentation.update(next, { x: 4, z: 4 }, 1, 1_000);
    presentation.frame(1_100);
    const after100 = debugVehicleMotion(presentation, 'drive-trip');
    presentation.frame(1_200);
    const after200 = debugVehicleMotion(presentation, 'drive-trip');

    expect(after100.visualDistanceMillimeters).toBeGreaterThan(4_000);
    expect(after100.visualDistanceMillimeters).toBeLessThan(8_000);
    expect(after100.visualSpeedMillimetersPerSecond).toBeGreaterThan(0);
    expect(after100.visualSpeedMillimetersPerSecond).toBeLessThan(
      after100.baselineFollowerSpeedMillimetersPerSecond,
    );
    expect(after200.visualSpeedMillimetersPerSecond).toBeGreaterThan(
      after100.visualSpeedMillimetersPerSecond,
    );
    expect(after200.visualDistanceMillimeters).toBeLessThanOrEqual(
      after200.canonicalTargetDistanceMillimeters,
    );

    const queued = Object.freeze({
      ...next,
      trafficRevision: 9,
      agents: Object.freeze(
        next.agents.map((agent) =>
          agent.mode === 'Drive' ? Object.freeze({ ...agent, queued: true }) : agent,
        ),
      ),
    });
    presentation.update(queued, { x: 4, z: 4 }, 2, 1_300);
    const beforeBrake = debugVehicleMotion(
      presentation,
      'drive-trip',
    ).visualSpeedMillimetersPerSecond;
    presentation.frame(1_400);
    const afterBrake = debugVehicleMotion(
      presentation,
      'drive-trip',
    ).visualSpeedMillimetersPerSecond;
    expect(afterBrake).toBeLessThan(beforeBrake);
    presentation.dispose();
  });

  it('interpolates a stable vehicle visual between canonical snapshots', () => {
    const scene = new Scene();
    const presentation = new TrafficPresentation(scene);
    const initial = snapshot();
    presentation.update(initial, { x: 4, z: 4 }, 0, 0);

    const next = Object.freeze({
      ...initial,
      trafficRevision: 8,
      agents: Object.freeze(
        initial.agents.map((agent) =>
          agent.mode === 'Drive'
            ? Object.freeze({ ...agent, progressQ: 1_000_000, routeDistanceMillimeters: 8_000 })
            : agent,
        ),
      ),
    });
    presentation.update(next, { x: 4, z: 4 }, 1, 1_000);
    presentation.update(next, { x: 4, z: 4 }, 2, 1_500);

    const vehicleRoot = scene.getObjectByName('traffic-vehicle-root')!;
    const vehicle = vehicleRoot.children[0]!;
    expect(vehicle.position.x).toBeGreaterThan(4);
    expect(vehicle.position.x).toBeLessThan(8);
    expect(initial.agents[1]!.progressQ).toBe(500_000);
    presentation.dispose();
  });

  it('keeps a completed vehicle visible for a bounded route-end presentation', () => {
    const scene = new Scene();
    const presentation = new TrafficPresentation(scene);
    const initial = snapshot();
    presentation.update(initial, { x: 4, z: 4 }, 0, 0);

    const arrived = Object.freeze({
      ...initial,
      trafficRevision: 8,
      agents: Object.freeze([initial.agents[0]!]),
    });
    presentation.update(arrived, { x: 4, z: 4 }, 1, 1_000);
    expect(presentation.debugSnapshot().visibleVehicles).toBe(1);

    presentation.update(arrived, { x: 4, z: 4 }, 2, 1_200);
    expect(presentation.debugSnapshot().visibleVehicles).toBe(0);
    presentation.dispose();
  });
});
