import type {
  CitizenMobilityState,
  MobilityActivityKind,
  MobilityTrip,
  MobilityTripFailureReason,
  MobilityTripMode,
  MobilityTripPurpose,
  MobilityTripStatus,
} from './contracts.js';
import { MobilityContractError } from './errors.js';
import {
  absoluteGameMinute,
  gameMinuteValue,
  type AbsoluteGameMinute,
} from '@web-three-city/simulation-core';
import {
  MOBILITY_POLICY_VERSION,
  MOBILITY_SCHEMA_VERSION,
  MOBILITY_SCHEDULE_SEED_VERSION,
  createMobilitySnapshot,
  type MobilitySnapshotV1,
} from './mobility-snapshot.js';

export interface MobilitySaveV1 {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly policyVersion: 1;
  readonly scheduleSeedVersion: 1;
  readonly nextTripSequence: number;
  readonly citizenStates: readonly MobilitySaveCitizenState[];
  readonly trips: readonly MobilitySaveTrip[];
}

/**
 * Current persistence envelope. The in-memory snapshot remains the durable
 * trip authority; `schedulePolicyVersion` declares that only future schedule
 * collection uses SchedulePolicyV2 after load/migration.
 */
export interface MobilitySaveV2 {
  readonly schemaVersion: 2;
  readonly revision: number;
  readonly policyVersion: 2;
  readonly schedulePolicyVersion: 2;
  readonly scheduleSeedVersion: 1;
  readonly nextTripSequence: number;
  readonly citizenStates: readonly MobilitySaveCitizenState[];
  readonly trips: readonly MobilitySaveTrip[];
}

/**
 * Legacy V1/V2 wire fields intentionally retain their historical names and
 * numeric payloads. They are decoded into the typed in-memory authority below.
 */
export interface MobilitySaveCitizenState {
  readonly citizenId: string;
  readonly currentActivity: MobilityActivityKind;
  readonly stationaryBuildingId: string | null;
  readonly activeTripId: string | null;
  readonly scheduleCursorDay: number;
  readonly nextBoundaryGameMinute: number | null;
}

export interface MobilitySaveTrip {
  readonly tripId: string;
  readonly citizenId: string;
  readonly purpose: MobilityTripPurpose;
  readonly originBuildingId: string;
  readonly destinationBuildingId: string;
  readonly mode: MobilityTripMode | null;
  readonly departureGameMinute: number;
  readonly status: MobilityTripStatus;
  readonly failureReason: MobilityTripFailureReason | null;
}

export type MobilitySaveDecodeResult =
  | Readonly<{ ok: true; value: MobilitySnapshotV1 }>
  | Readonly<{ ok: false; error: Readonly<{ code: 'mobility-save:invalid' }> }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const activities = new Set(['Home', 'Work', 'Idle', 'Travel']);
const purposes = new Set(['CommuteToWork', 'CommuteHome']);
const modes = new Set(['Walk', 'Drive']);
const statuses = new Set(['Planned', 'Active', 'Arrived', 'Failed', 'Cancelled']);
const failureReasons = new Set(['Unreachable', 'OriginUnavailable', 'DestinationUnavailable']);

function parseAbsoluteGameMinute(value: unknown): AbsoluteGameMinute | null {
  if (typeof value !== 'number') return null;
  try {
    return absoluteGameMinute(value);
  } catch {
    return null;
  }
}

function parseCitizenState(value: unknown): CitizenMobilityState | null {
  if (!isRecord(value)) return null;
  if (typeof value.citizenId !== 'string') return null;
  if (typeof value.currentActivity !== 'string' || !activities.has(value.currentActivity))
    return null;
  if (value.stationaryBuildingId !== null && typeof value.stationaryBuildingId !== 'string')
    return null;
  if (value.activeTripId !== null && typeof value.activeTripId !== 'string') return null;
  if (
    typeof value.scheduleCursorDay !== 'number' ||
    !Number.isSafeInteger(value.scheduleCursorDay) ||
    value.scheduleCursorDay < 0
  )
    return null;
  const nextBoundaryGameMinute =
    value.nextBoundaryGameMinute === null
      ? null
      : parseAbsoluteGameMinute(value.nextBoundaryGameMinute);
  if (value.nextBoundaryGameMinute !== null && nextBoundaryGameMinute === null) return null;
  return Object.freeze({
    citizenId: value.citizenId,
    currentActivity: value.currentActivity as CitizenMobilityState['currentActivity'],
    stationaryBuildingId: value.stationaryBuildingId as string | null,
    activeTripId: value.activeTripId as string | null,
    scheduleCursorCycle: value.scheduleCursorDay as number,
    nextBoundaryGameMinute,
  });
}

function parseTrip(value: unknown): MobilityTrip | null {
  if (!isRecord(value)) return null;
  if (typeof value.tripId !== 'string' || typeof value.citizenId !== 'string') return null;
  if (typeof value.purpose !== 'string' || !purposes.has(value.purpose)) return null;
  if (typeof value.originBuildingId !== 'string' || typeof value.destinationBuildingId !== 'string')
    return null;
  if (value.mode !== null && (typeof value.mode !== 'string' || !modes.has(value.mode)))
    return null;
  const departureGameMinute = parseAbsoluteGameMinute(value.departureGameMinute);
  if (departureGameMinute === null) return null;
  if (typeof value.status !== 'string' || !statuses.has(value.status)) return null;
  if (
    value.failureReason !== null &&
    (typeof value.failureReason !== 'string' || !failureReasons.has(value.failureReason))
  )
    return null;
  return Object.freeze({
    tripId: value.tripId,
    citizenId: value.citizenId,
    purpose: value.purpose as MobilityTrip['purpose'],
    originBuildingId: value.originBuildingId,
    destinationBuildingId: value.destinationBuildingId,
    mode: value.mode as MobilityTrip['mode'],
    departureGameMinute,
    status: value.status as MobilityTrip['status'],
    failureReason: value.failureReason as MobilityTrip['failureReason'],
  });
}

export function encodeMobilitySaveV1(snapshot: MobilitySnapshotV1): MobilitySaveV1 {
  const canonical = createMobilitySnapshot(snapshot);
  return Object.freeze({
    schemaVersion: MOBILITY_SCHEMA_VERSION,
    revision: canonical.revision,
    policyVersion: MOBILITY_POLICY_VERSION,
    scheduleSeedVersion: MOBILITY_SCHEDULE_SEED_VERSION,
    nextTripSequence: canonical.nextTripSequence,
    citizenStates: Object.freeze(
      canonical.citizenStates.map((state) =>
        Object.freeze({
          citizenId: state.citizenId,
          currentActivity: state.currentActivity,
          stationaryBuildingId: state.stationaryBuildingId,
          activeTripId: state.activeTripId,
          scheduleCursorDay: state.scheduleCursorCycle,
          nextBoundaryGameMinute:
            state.nextBoundaryGameMinute === null
              ? null
              : gameMinuteValue(state.nextBoundaryGameMinute),
        }),
      ),
    ),
    trips: Object.freeze(
      canonical.trips.map((trip) =>
        Object.freeze({
          tripId: trip.tripId,
          citizenId: trip.citizenId,
          purpose: trip.purpose,
          originBuildingId: trip.originBuildingId,
          destinationBuildingId: trip.destinationBuildingId,
          mode: trip.mode,
          departureGameMinute: gameMinuteValue(trip.departureGameMinute),
          status: trip.status,
          failureReason: trip.failureReason,
        }),
      ),
    ),
  });
}

export function decodeMobilitySaveV1(input: unknown): MobilitySaveDecodeResult {
  if (!isRecord(input))
    return Object.freeze({ ok: false, error: Object.freeze({ code: 'mobility-save:invalid' }) });
  if (
    input.schemaVersion !== MOBILITY_SCHEMA_VERSION ||
    input.policyVersion !== MOBILITY_POLICY_VERSION ||
    input.scheduleSeedVersion !== MOBILITY_SCHEDULE_SEED_VERSION ||
    !Number.isSafeInteger(input.revision) ||
    !Number.isSafeInteger(input.nextTripSequence) ||
    !Array.isArray(input.citizenStates) ||
    !Array.isArray(input.trips)
  ) {
    return Object.freeze({ ok: false, error: Object.freeze({ code: 'mobility-save:invalid' }) });
  }

  const citizenStates = input.citizenStates.map(parseCitizenState);
  const trips = input.trips.map(parseTrip);
  if (citizenStates.some((value) => value === null) || trips.some((value) => value === null)) {
    return Object.freeze({ ok: false, error: Object.freeze({ code: 'mobility-save:invalid' }) });
  }

  try {
    return Object.freeze({
      ok: true,
      value: createMobilitySnapshot({
        schemaVersion: MOBILITY_SCHEMA_VERSION,
        revision: input.revision as number,
        policyVersion: MOBILITY_POLICY_VERSION,
        scheduleSeedVersion: MOBILITY_SCHEDULE_SEED_VERSION,
        nextTripSequence: input.nextTripSequence as number,
        citizenStates: citizenStates as CitizenMobilityState[],
        trips: trips as MobilityTrip[],
      }),
    });
  } catch (error) {
    if (error instanceof MobilityContractError) {
      return Object.freeze({ ok: false, error: Object.freeze({ code: 'mobility-save:invalid' }) });
    }
    throw error;
  }
}

export function encodeMobilitySaveV2(snapshot: MobilitySnapshotV1): MobilitySaveV2 {
  const canonical = createMobilitySnapshot(snapshot);
  return Object.freeze({
    schemaVersion: 2,
    revision: canonical.revision,
    policyVersion: 2,
    schedulePolicyVersion: 2,
    scheduleSeedVersion: canonical.scheduleSeedVersion,
    nextTripSequence: canonical.nextTripSequence,
    citizenStates: Object.freeze(
      canonical.citizenStates.map((state) =>
        Object.freeze({
          citizenId: state.citizenId,
          currentActivity: state.currentActivity,
          stationaryBuildingId: state.stationaryBuildingId,
          activeTripId: state.activeTripId,
          scheduleCursorDay: state.scheduleCursorCycle,
          nextBoundaryGameMinute:
            state.nextBoundaryGameMinute === null
              ? null
              : gameMinuteValue(state.nextBoundaryGameMinute),
        }),
      ),
    ),
    trips: Object.freeze(
      canonical.trips.map((trip) =>
        Object.freeze({
          tripId: trip.tripId,
          citizenId: trip.citizenId,
          purpose: trip.purpose,
          originBuildingId: trip.originBuildingId,
          destinationBuildingId: trip.destinationBuildingId,
          mode: trip.mode,
          departureGameMinute: gameMinuteValue(trip.departureGameMinute),
          status: trip.status,
          failureReason: trip.failureReason,
        }),
      ),
    ),
  });
}

export function decodeMobilitySaveV2(input: unknown): MobilitySaveDecodeResult {
  if (
    !isRecord(input) ||
    input.schemaVersion !== 2 ||
    input.policyVersion !== 2 ||
    input.schedulePolicyVersion !== 2 ||
    input.scheduleSeedVersion !== MOBILITY_SCHEDULE_SEED_VERSION ||
    !Number.isSafeInteger(input.revision) ||
    !Number.isSafeInteger(input.nextTripSequence) ||
    !Array.isArray(input.citizenStates) ||
    !Array.isArray(input.trips)
  ) {
    return Object.freeze({ ok: false, error: Object.freeze({ code: 'mobility-save:invalid' }) });
  }

  return decodeMobilitySaveV1(
    Object.freeze({
      schemaVersion: MOBILITY_SCHEMA_VERSION,
      revision: input.revision,
      policyVersion: MOBILITY_POLICY_VERSION,
      scheduleSeedVersion: input.scheduleSeedVersion,
      nextTripSequence: input.nextTripSequence,
      citizenStates: input.citizenStates,
      trips: input.trips,
    }),
  );
}

/** Pure migration for legacy V1 bytes; callers choose when to write V2. */
export function migrateMobilitySaveV1ToV2(input: MobilitySaveV1): MobilitySaveV2 {
  const decoded = decodeMobilitySaveV1(input);
  if (!decoded.ok) throw new MobilityContractError('mobility:invalid-state');
  return encodeMobilitySaveV2(decoded.value);
}
