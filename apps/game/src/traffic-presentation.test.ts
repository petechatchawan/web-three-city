import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { TrafficPresentation } from './traffic-presentation.js';
import type { TrafficPresentationSnapshot } from './traffic-presentation-projection.js';

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
      }),
    ]),
  });
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
});
