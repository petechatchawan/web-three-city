import { describe, expect, it } from 'vitest';
import { deriveVehicleVisualPlacements } from '../src/index.js';

describe('PR3 lane-owned vehicle spacing', () => {
  it('keeps same-direction vehicles on the derived lane centerline while retaining longitudinal headway', () => {
    const placements = deriveVehicleVisualPlacements(
      ['a', 'b', 'c'].map((tripId) => ({
        tripId,
        edgeId: 'shared-edge',
        progressQ: 500_000,
        edgeLengthMillimeters: 8_000,
        queued: false,
      })),
      1_000,
    );

    expect(placements.map((placement) => placement.lateralOffsetMillimeters)).toEqual([0, 0, 0]);
    expect(placements.map((placement) => placement.adjustedProgressQ)).toEqual([500_000, 375_000, 250_000]);
  });
});
