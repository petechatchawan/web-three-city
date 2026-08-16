import { describe, expect, it } from 'vitest';
import {
  TrafficPedestrianPool,
  TrafficVehiclePool,
  TrafficSpatialIndex,
  deriveVehicleVisualPlacements,
  pedestrianAppearanceForCitizen,
  selectTrafficAgentsForMaterialization,
  vehicleAppearanceForTrip,
  type TrafficSpatialAgent,
} from '../src/index.js';

function agent(index: number, mode: 'Walk' | 'Drive', xMeters: number): TrafficSpatialAgent {
  return Object.freeze({
    tripId: `trip-${String(index).padStart(4, '0')}`,
    citizenId: `citizen-${String(index).padStart(4, '0')}`,
    mode,
    routeEdgeId: `edge-${Math.floor(index / 5)}`,
    progressQ: 500_000,
    queued: false,
    from: Object.freeze({ xQ: xMeters * 1000, yQ: 0, zQ: 0 }),
    to: Object.freeze({ xQ: (xMeters + 8) * 1000, yQ: 0, zQ: 0 }),
  });
}

describe('traffic-three production hardening', () => {
  it('derives stable Citizen and vehicle appearance without persisted render state', () => {
    expect(pedestrianAppearanceForCitizen('citizen-1')).toEqual(
      pedestrianAppearanceForCitizen('citizen-1'),
    );
    expect(vehicleAppearanceForTrip('trip-1', 'citizen-1')).toEqual(
      vehicleAppearanceForTrip('trip-1', 'citizen-1'),
    );
  });

  it('reuses pooled pedestrian and vehicle hierarchies after dematerialization', () => {
    const pedestrianPool = new TrafficPedestrianPool();
    const vehiclePool = new TrafficVehiclePool();
    const base = {
      citizenId: 'citizen-1',
      routeEdgeId: 'edge-1',
      progressQ: 100_000,
      queued: false,
      from: { xQ: 0, yQ: 0, zQ: 0 },
      to: { xQ: 8_000, yQ: 0, zQ: 0 },
    } as const;
    pedestrianPool.acquire({ ...base, tripId: 'walk-1' });
    vehiclePool.acquire({ ...base, tripId: 'drive-1' });
    pedestrianPool.release('walk-1');
    vehiclePool.release('drive-1');
    pedestrianPool.acquire({ ...base, tripId: 'walk-2' });
    vehiclePool.acquire({ ...base, tripId: 'drive-2' });
    expect(pedestrianPool.createdCount).toBe(1);
    expect(vehiclePool.createdCount).toBe(1);
    expect(pedestrianPool.reuseCount).toBe(1);
    expect(vehiclePool.reuseCount).toBe(1);
    pedestrianPool.dispose();
    vehiclePool.dispose();
  });

  it('queries local spatial buckets instead of scanning all world trips', () => {
    const agents = Array.from({ length: 5_000 }, (_, index) =>
      agent(index, index % 2 === 0 ? 'Walk' : 'Drive', index * 20),
    );
    const index = new TrafficSpatialIndex(agents, 64);
    const result = index.query({ centerX: 200, centerZ: 0, radius: 100 });
    expect(result.metrics.visitedBucketCount).toBeLessThan(index.bucketCount);
    expect(result.metrics.candidateTripCount).toBeLessThan(agents.length);
    expect(result.candidates.every((candidate) => candidate.distanceSquared <= 10_000)).toBe(true);
  });

  it('enforces independent mode caps and combined full-detail budget deterministically', () => {
    const pedestrians = Array.from({ length: 350 }, (_, index) => ({
      agent: agent(index, 'Walk', index * 0.01),
      distanceSquared: index * 0.001,
    }));
    const vehicles = Array.from({ length: 350 }, (_, index) => ({
      agent: agent(index + 1000, 'Drive', index * 0.01),
      distanceSquared: index * 0.001 + 0.0005,
    }));
    const selection = selectTrafficAgentsForMaterialization({
      candidates: [...vehicles, ...pedestrians].reverse(),
      frameIndex: 0,
    });
    expect(selection.pedestrianCount).toBeLessThanOrEqual(300);
    expect(selection.vehicleCount).toBeLessThanOrEqual(300);
    expect(selection.nearCount).toBeLessThanOrEqual(500);
    const second = selectTrafficAgentsForMaterialization({
      candidates: [...pedestrians, ...vehicles],
      frameIndex: 0,
    });
    expect(selection.selected.map((entry) => entry.agent.tripId)).toEqual(
      second.selected.map((entry) => entry.agent.tripId),
    );
  });

  it('keeps Mid agents selected while reducing their update cadence', () => {
    const candidate = {
      agent: agent(1, 'Walk', 150),
      distanceSquared: 150 * 150,
    };
    const frameOne = selectTrafficAgentsForMaterialization({
      candidates: [candidate],
      frameIndex: 1,
    });
    const frameThree = selectTrafficAgentsForMaterialization({
      candidates: [candidate],
      frameIndex: 3,
    });
    expect(frameOne.selected).toHaveLength(1);
    expect(frameOne.selected[0]?.tier).toBe('Mid');
    expect(frameOne.selected[0]?.updateDue).toBe(false);
    expect(frameThree.selected[0]?.updateDue).toBe(true);
  });

  it('derives visual vehicle headway without changing authoritative trip progress', () => {
    const placements = deriveVehicleVisualPlacements(
      [
        {
          tripId: 'front',
          edgeId: 'edge',
          progressQ: 900_000,
          edgeLengthMillimeters: 20_000,
          queued: false,
        },
        {
          tripId: 'rear',
          edgeId: 'edge',
          progressQ: 850_000,
          edgeLengthMillimeters: 20_000,
          queued: false,
        },
      ],
      4_500,
    );
    const front = placements.find((entry) => entry.tripId === 'front')!;
    const rear = placements.find((entry) => entry.tripId === 'rear')!;
    expect(
      front.distanceAlongEdgeMillimeters - rear.distanceAlongEdgeMillimeters,
    ).toBeGreaterThanOrEqual(4_500);
    expect(rear.adjustedProgressQ).toBeLessThan(850_000);
  });

  it('assigns deterministic lateral lanes to same-tick same-route vehicles', () => {
    const inputs = ['a', 'b', 'c'].map((tripId) => ({
      tripId,
      edgeId: 'shared-edge',
      progressQ: 500_000,
      edgeLengthMillimeters: 8_000,
      queued: false,
    }));
    const first = deriveVehicleVisualPlacements(inputs, 1_000);
    const second = deriveVehicleVisualPlacements([...inputs].reverse(), 1_000);

    expect(first.map((placement) => placement.tripId)).toEqual(['a', 'b', 'c']);
    expect(first.map((placement) => placement.lateralOffsetMillimeters)).toEqual([
      0, 1_700, -1_700,
    ]);
    expect(second).toEqual(first);
  });
});
