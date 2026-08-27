import { describe, expect, it } from 'vitest';
import * as mobilityCore from '../src/index.js';
import { absoluteGameMinute } from '@web-three-city/simulation-core';
import type { MobilitySaveV1, MobilitySnapshotV1 } from '../src/index.js';

type MobilitySaveV2Api = Readonly<{
  encodeMobilitySaveV2?: (snapshot: MobilitySnapshotV1) => unknown;
  decodeMobilitySaveV2?: (
    input: unknown,
  ) =>
    | Readonly<{ ok: true; value: MobilitySnapshotV1 }>
    | Readonly<{ ok: false; error: Readonly<{ code: 'mobility-save:invalid' }> }>;
  migrateMobilitySaveV1ToV2?: (input: MobilitySaveV1) => unknown;
}>;

const api = mobilityCore as MobilitySaveV2Api;

const activeDriveSnapshot: MobilitySnapshotV1 = Object.freeze({
  schemaVersion: 1,
  revision: 7,
  policyVersion: 1,
  scheduleSeedVersion: 1,
  nextTripSequence: 2,
  citizenStates: Object.freeze([
    Object.freeze({
      citizenId: 'citizen-1',
      currentActivity: 'Travel' as const,
      stationaryBuildingId: null,
      activeTripId: 'mobility-trip-0000000001',
      scheduleCursorCycle: 0,
      nextBoundaryGameMinute: absoluteGameMinute(540),
    }),
  ]),
  trips: Object.freeze([
    Object.freeze({
      tripId: 'mobility-trip-0000000001',
      citizenId: 'citizen-1',
      purpose: 'CommuteToWork' as const,
      originBuildingId: 'home-1',
      destinationBuildingId: 'work-1',
      mode: 'Drive' as const,
      departureGameMinute: absoluteGameMinute(480),
      status: 'Active' as const,
      failureReason: null,
    }),
  ]),
});

describe('MobilitySaveV2', () => {
  it('preserves committed trip facts while declaring SchedulePolicyV2 for future boundaries', () => {
    expect(typeof api.encodeMobilitySaveV2).toBe('function');
    expect(typeof api.decodeMobilitySaveV2).toBe('function');

    const save = api.encodeMobilitySaveV2!(activeDriveSnapshot) as Record<string, unknown>;
    expect(save).toMatchObject({ schemaVersion: 2, policyVersion: 2, schedulePolicyVersion: 2 });

    const decoded = api.decodeMobilitySaveV2!(JSON.parse(JSON.stringify(save)) as unknown);
    expect(decoded).toEqual({ ok: true, value: activeDriveSnapshot });
  });

  it('migrates V1 without rewriting the source bytes or committed trip facts', () => {
    expect(typeof api.migrateMobilitySaveV1ToV2).toBe('function');
    const source = mobilityCore.encodeMobilitySaveV1(activeDriveSnapshot);
    const sourceBytes = JSON.stringify(source);

    const migrated = api.migrateMobilitySaveV1ToV2!(source) as Record<string, unknown>;
    expect(migrated).toMatchObject({
      schemaVersion: 2,
      policyVersion: 2,
      schedulePolicyVersion: 2,
    });
    expect(migrated.trips).toEqual(source.trips);
    expect(JSON.stringify(source)).toBe(sourceBytes);
  });
});
