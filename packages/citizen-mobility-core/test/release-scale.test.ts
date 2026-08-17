import { describe, expect, it } from 'vitest';
import {
  collectDueMobilityBoundaries,
  createEmptyMobilitySnapshot,
  planMobilityBoundaries,
  reconcileMobilityCitizens,
} from '../src/index.js';

function citizens() {
  return Object.freeze(
    Array.from({ length: 20_000 }, (_, index) =>
      Object.freeze({
        citizenId: `citizen-${String(index).padStart(5, '0')}`,
        homeBuildingId: `home-${index % 1000}`,
        workBuildingId: `work-${index % 500}`,
        present: true,
      }),
    ),
  );
}

function planningFingerprint() {
  const inputCitizens = citizens();
  const snapshot = reconcileMobilityCitizens({
    snapshot: createEmptyMobilitySnapshot(),
    citizens: inputCitizens,
  }).snapshot;
  const boundaries = collectDueMobilityBoundaries({
    citizens: inputCitizens,
    fromGameMinuteExclusive: 6 * 60,
    toGameMinuteInclusive: 10 * 60,
  });
  const plan = planMobilityBoundaries({ snapshot, boundaries, citizens: inputCitizens });
  return JSON.stringify({
    boundaryCount: boundaries.length,
    boundaries: boundaries.map((entry) => [
      entry.citizenId,
      entry.atGameMinute,
      entry.nextActivity,
    ]),
    requests: plan.planningRequests.map((request) => [
      request.tripId,
      request.citizenId,
      request.originBuildingId,
      request.destinationBuildingId,
      request.departureGameMinute,
    ]),
  });
}

describe('Citizen Mobility release scale gate', () => {
  it('produces identical 20,000-Citizen schedule and trip-plan fingerprints for identical input', () => {
    const first = planningFingerprint();
    const second = planningFingerprint();
    expect(first).toBe(second);
    const decoded = JSON.parse(first) as { boundaryCount: number; requests: unknown[] };
    expect(decoded.boundaryCount).toBe(20_000);
    expect(decoded.requests).toHaveLength(20_000);
  });
});
