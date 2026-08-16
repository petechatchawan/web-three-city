import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { TrafficVehiclePool, vehicleAppearanceForTrip } from '../src/index.js';

describe('Traffic vehicle agents', () => {
  it('materializes a real Drive trip with Citizen/trip identity', () => {
    const pool = new TrafficVehiclePool();
    const agent = pool.acquire({
      tripId: 'drive-trip-1',
      citizenId: 'citizen-1',
      routeEdgeId: 'drive-edge-1',
      progressQ: 500_000,
      queued: false,
      from: { xQ: 0, yQ: 0, zQ: 0 },
      to: { xQ: 8_000, yQ: 0, zQ: 0 },
      turn: null,
    });
    expect(agent.object.userData).toMatchObject({
      trafficAgentKind: 'vehicle',
      citizenId: 'citizen-1',
      tripId: 'drive-trip-1',
      trafficVisualState: 'Drive',
    });
    expect(vehicleAppearanceForTrip('drive-trip-1', 'citizen-1')).toEqual(
      vehicleAppearanceForTrip('drive-trip-1', 'citizen-1'),
    );
    pool.dispose();
  });

  it('keeps the complete vehicle visual inside the basic-road presentation envelope', () => {
    const pool = new TrafficVehiclePool();
    const agent = pool.acquire({
      tripId: 'drive-scale-1',
      citizenId: 'citizen-scale-1',
      routeEdgeId: 'drive-edge-1',
      progressQ: 500_000,
      queued: false,
      from: { xQ: 0, yQ: 0, zQ: 0 },
      to: { xQ: 8_000, yQ: 0, zQ: 0 },
      turn: null,
    });
    const size = new Box3().setFromObject(agent.object).getSize(new Vector3());
    const horizontal = [size.x, size.z].sort((a, b) => a - b);

    expect(horizontal[0]).toBeLessThanOrEqual(0.288);
    expect(horizontal[1]).toBeLessThanOrEqual(0.612);
    pool.dispose();
  });

  it('derives Stop and Turn visual states without becoming Traffic authority', () => {
    const pool = new TrafficVehiclePool();
    const base = {
      tripId: 'drive-trip-1',
      citizenId: 'citizen-1',
      routeEdgeId: 'drive-edge-1',
      progressQ: 900_000,
      from: { xQ: 0, yQ: 0, zQ: 0 },
      to: { xQ: 8_000, yQ: 0, zQ: 0 },
    } as const;
    const stopped = pool.acquire({ ...base, queued: true, turn: null });
    expect(stopped.object.userData.trafficVisualState).toBe('Stop');
    const turning = pool.acquire({
      ...base,
      queued: false,
      turn: {
        previous: { xQ: 0, yQ: 0, zQ: 0 },
        corner: { xQ: 8_000, yQ: 0, zQ: 0 },
        next: { xQ: 8_000, yQ: 0, zQ: 8_000 },
        turnProgressQ: 500_000,
      },
    });
    expect(turning.object.userData.trafficVisualState).toBe('Turn');
    pool.dispose();
  });
});
