import { assertMobilityId, type PresentCitizenMobilityProjection } from './contracts.js';
import { MobilityContractError } from './errors.js';

export interface FoundationMobilitySchedulePolicyV1 {
  readonly version: 1;
  readonly workStartEarliestMinuteOfDay: 420;
  readonly workStartLatestMinuteOfDay: 540;
  readonly workDurationMinutes: 540;
}

export interface DueMobilityBoundary {
  readonly citizenId: string;
  readonly atGameMinute: number;
  readonly nextActivity: 'Work' | 'Home';
}

export const FOUNDATION_MOBILITY_SCHEDULE_POLICY_V1: FoundationMobilitySchedulePolicyV1 = Object.freeze({
  version: 1,
  workStartEarliestMinuteOfDay: 420,
  workStartLatestMinuteOfDay: 540,
  workDurationMinutes: 540,
});

function assertDayIndex(dayIndex: number): void {
  if (!Number.isSafeInteger(dayIndex) || dayIndex < 0) {
    throw new MobilityContractError('mobility:invalid-time');
  }
}

function hashText(text: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function deterministicScheduleOffset(
  citizenId: string,
  dayIndex: number,
  scheduleSeedVersion = 1,
  policyVersion = 1,
): number {
  assertMobilityId(citizenId);
  assertDayIndex(dayIndex);
  if (!Number.isSafeInteger(scheduleSeedVersion) || scheduleSeedVersion < 1) {
    throw new MobilityContractError('mobility:invalid-state');
  }
  if (!Number.isSafeInteger(policyVersion) || policyVersion < 1) {
    throw new MobilityContractError('mobility:invalid-state');
  }
  const span =
    FOUNDATION_MOBILITY_SCHEDULE_POLICY_V1.workStartLatestMinuteOfDay -
    FOUNDATION_MOBILITY_SCHEDULE_POLICY_V1.workStartEarliestMinuteOfDay +
    1;
  return hashText(`${citizenId}|${dayIndex}|${scheduleSeedVersion}|${policyVersion}`) % span;
}

export function deriveCitizenScheduleForDay(
  citizen: PresentCitizenMobilityProjection,
  dayIndex: number,
  policy: FoundationMobilitySchedulePolicyV1 = FOUNDATION_MOBILITY_SCHEDULE_POLICY_V1,
  scheduleSeedVersion = 1,
): readonly DueMobilityBoundary[] {
  assertMobilityId(citizen.citizenId);
  assertDayIndex(dayIndex);
  if (!citizen.present || citizen.homeBuildingId === null || citizen.workBuildingId === null) {
    return Object.freeze([]);
  }
  const dayStart = dayIndex * 1440;
  if (!Number.isSafeInteger(dayStart)) throw new MobilityContractError('mobility:invalid-time');
  const workStart =
    dayStart +
    policy.workStartEarliestMinuteOfDay +
    deterministicScheduleOffset(citizen.citizenId, dayIndex, scheduleSeedVersion, policy.version);
  const returnHome = workStart + policy.workDurationMinutes;
  return Object.freeze([
    Object.freeze({ citizenId: citizen.citizenId, atGameMinute: workStart, nextActivity: 'Work' as const }),
    Object.freeze({ citizenId: citizen.citizenId, atGameMinute: returnHome, nextActivity: 'Home' as const }),
  ]);
}
