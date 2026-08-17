import { describe, expect, it } from 'vitest';
import {
  createEmptyMobilitySnapshot,
  createMobilitySnapshot,
  decodeMobilitySaveV1,
  encodeMobilitySaveV1,
  fingerprintMobilitySnapshot,
} from '../src/index.js';

describe('MobilitySnapshotV1', () => {
  it('keeps one canonical sorted Citizen authority and stable fingerprint', () => {
    const snapshot = createMobilitySnapshot({
      schemaVersion: 1,
      revision: 4,
      policyVersion: 1,
      scheduleSeedVersion: 1,
      nextTripSequence: 3,
      citizenStates: [
        {
          citizenId: 'citizen-2',
          currentActivity: 'Idle',
          stationaryBuildingId: null,
          activeTripId: null,
          scheduleCursorDay: 0,
          nextBoundaryGameMinute: null,
        },
        {
          citizenId: 'citizen-1',
          currentActivity: 'Home',
          stationaryBuildingId: 'home-1',
          activeTripId: null,
          scheduleCursorDay: 0,
          nextBoundaryGameMinute: 480,
        },
      ],
      trips: [],
    });

    expect(snapshot.citizenStates.map((state) => state.citizenId)).toEqual([
      'citizen-1',
      'citizen-2',
    ]);
    expect(fingerprintMobilitySnapshot(snapshot)).toBe(
      fingerprintMobilitySnapshot(createMobilitySnapshot(snapshot)),
    );
  });

  it('rejects a Travel state without exactly one referenced active trip', () => {
    expect(() =>
      createMobilitySnapshot({
        ...createEmptyMobilitySnapshot(),
        citizenStates: [
          {
            citizenId: 'citizen-1',
            currentActivity: 'Travel',
            stationaryBuildingId: null,
            activeTripId: 'mobility-trip-0000000001',
            scheduleCursorDay: 0,
            nextBoundaryGameMinute: null,
          },
        ],
      }),
    ).toThrow('mobility:missing-active-trip');
  });

  it('round-trips only logical mobility state through MobilitySaveV1', () => {
    const snapshot = createMobilitySnapshot({
      ...createEmptyMobilitySnapshot(),
      revision: 2,
      nextTripSequence: 2,
      citizenStates: [
        {
          citizenId: 'citizen-1',
          currentActivity: 'Travel',
          stationaryBuildingId: null,
          activeTripId: 'mobility-trip-0000000001',
          scheduleCursorDay: 1,
          nextBoundaryGameMinute: 1860,
        },
      ],
      trips: [
        {
          tripId: 'mobility-trip-0000000001',
          citizenId: 'citizen-1',
          purpose: 'CommuteToWork',
          originBuildingId: 'home-1',
          destinationBuildingId: 'work-1',
          mode: 'Drive',
          departureGameMinute: 450,
          status: 'Active',
          failureReason: null,
        },
      ],
    });

    const save = encodeMobilitySaveV1(snapshot);
    const decoded = decodeMobilitySaveV1(JSON.parse(JSON.stringify(save)) as unknown);

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(fingerprintMobilitySnapshot(decoded.value)).toBe(fingerprintMobilitySnapshot(snapshot));
    expect(JSON.stringify(save)).not.toContain('routeEdge');
    expect(JSON.stringify(save)).not.toContain('Three');
  });

  it('fails closed for malformed saved state', () => {
    const result = decodeMobilitySaveV1({
      ...encodeMobilitySaveV1(createEmptyMobilitySnapshot()),
      nextTripSequence: -1,
    });
    expect(result).toEqual({ ok: false, error: { code: 'mobility-save:invalid' } });
  });
});
