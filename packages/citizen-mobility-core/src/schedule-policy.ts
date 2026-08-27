import { assertMobilityId, type PresentCitizenMobilityProjection } from './contracts.js';
import { MobilityContractError } from './errors.js';
import {
  absoluteGameMinute,
  addGameMinutes,
  gameMinuteDuration,
  type AbsoluteGameMinute,
} from '@web-three-city/simulation-core';

export interface FoundationMobilitySchedulePolicyV1 {
  readonly version: 1;
  readonly workStartEarliestMinuteOfDay: 420;
  readonly workStartLatestMinuteOfDay: 540;
  readonly workDurationMinutes: 540;
}

export interface FoundationMobilitySchedulePolicyV2 {
  readonly version: 2;
  readonly workStartEarliestMinuteOfDay: 420;
  readonly workStartLatestMinuteOfDay: 539;
  readonly workStartBaseEarliestMinuteOfDay: 425;
  readonly workStartBaseLatestMinuteOfDay: 534;
  readonly morningJitterMinutes: 5;
  readonly workDurationMinutes: 540;
  readonly returnJitterMinutes: 10;
  readonly workDurationMinimumMinutes: 525;
  readonly workDurationMaximumMinutes: 555;
  readonly workStartBucketWeights: readonly [15, 30, 35, 20];
}

export type FoundationMobilitySchedulePolicy =
  FoundationMobilitySchedulePolicyV1 | FoundationMobilitySchedulePolicyV2;

export interface DueMobilityBoundary {
  readonly citizenId: string;
  readonly atGameMinute: AbsoluteGameMinute;
  readonly nextActivity: 'Work' | 'Home';
}

export const FOUNDATION_MOBILITY_SCHEDULE_POLICY_V1: FoundationMobilitySchedulePolicyV1 =
  Object.freeze({
    version: 1,
    workStartEarliestMinuteOfDay: 420,
    workStartLatestMinuteOfDay: 540,
    workDurationMinutes: 540,
  });

export const FOUNDATION_MOBILITY_SCHEDULE_POLICY_V2: FoundationMobilitySchedulePolicyV2 =
  Object.freeze({
    version: 2,
    workStartEarliestMinuteOfDay: 420,
    workStartLatestMinuteOfDay: 539,
    workStartBaseEarliestMinuteOfDay: 425,
    workStartBaseLatestMinuteOfDay: 534,
    morningJitterMinutes: 5,
    workDurationMinutes: 540,
    returnJitterMinutes: 10,
    workDurationMinimumMinutes: 525,
    workDurationMaximumMinutes: 555,
    workStartBucketWeights: Object.freeze([15, 30, 35, 20]) as readonly [15, 30, 35, 20],
  });

const DERIVED_SCHEDULE_CACHE = new WeakMap<
  object,
  WeakMap<object, Map<string, readonly DueMobilityBoundary[]>>
>();
const MINUTES_PER_CYCLE = 24 * 60;
const ZERO_GAME_MINUTE = absoluteGameMinute(0);

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

function deterministicHash(
  namespace: string,
  citizenId: string,
  seedVersion: number,
  dayIndex?: number,
): number {
  return hashText(
    dayIndex === undefined
      ? `${namespace}|${citizenId}|${seedVersion}|2`
      : `${namespace}|${citizenId}|${dayIndex}|${seedVersion}|2`,
  );
}

function assertScheduleSeedVersion(scheduleSeedVersion: number): void {
  if (!Number.isSafeInteger(scheduleSeedVersion) || scheduleSeedVersion < 1) {
    throw new MobilityContractError('mobility:invalid-state');
  }
}

function v2BaseRangeForBucket(bucket: number): readonly [number, number] {
  switch (bucket) {
    case 0:
      return [425, 449];
    case 1:
      return [450, 479];
    case 2:
      return [480, 509];
    default:
      return [510, 534];
  }
}

function v2BucketForCitizen(citizenId: string, scheduleSeedVersion: number): number {
  const weightedSlot =
    deterministicHash('mobility.schedule.v2.base.bucket', citizenId, scheduleSeedVersion) % 100;
  return weightedSlot < 15 ? 0 : weightedSlot < 45 ? 1 : weightedSlot < 80 ? 2 : 3;
}

export function stableCommuteBaseMinuteOfDayForCitizen(
  citizenId: string,
  scheduleSeedVersion = 1,
): number {
  assertMobilityId(citizenId);
  assertScheduleSeedVersion(scheduleSeedVersion);
  const [earliest, latest] = v2BaseRangeForBucket(
    v2BucketForCitizen(citizenId, scheduleSeedVersion),
  );
  return (
    earliest +
    (deterministicHash('mobility.schedule.v2.base.minute', citizenId, scheduleSeedVersion) %
      (latest - earliest + 1))
  );
}

function v2MorningJitterMinutes(
  citizenId: string,
  dayIndex: number,
  scheduleSeedVersion: number,
): number {
  return (
    (deterministicHash(
      'mobility.schedule.v2.morning-jitter',
      citizenId,
      scheduleSeedVersion,
      dayIndex,
    ) %
      11) -
    5
  );
}

function v2ReturnJitterMinutes(
  citizenId: string,
  dayIndex: number,
  scheduleSeedVersion: number,
): number {
  return (
    (deterministicHash(
      'mobility.schedule.v2.return-jitter',
      citizenId,
      scheduleSeedVersion,
      dayIndex,
    ) %
      21) -
    10
  );
}

export function deterministicScheduleOffset(
  citizenId: string,
  dayIndex: number,
  scheduleSeedVersion = 1,
  policyVersion = 1,
): number {
  assertMobilityId(citizenId);
  assertDayIndex(dayIndex);
  assertScheduleSeedVersion(scheduleSeedVersion);
  if (!Number.isSafeInteger(policyVersion) || policyVersion < 1) {
    throw new MobilityContractError('mobility:invalid-state');
  }
  const span =
    FOUNDATION_MOBILITY_SCHEDULE_POLICY_V1.workStartLatestMinuteOfDay -
    FOUNDATION_MOBILITY_SCHEDULE_POLICY_V1.workStartEarliestMinuteOfDay +
    1;
  return hashText(`${citizenId}|${dayIndex}|${scheduleSeedVersion}|${policyVersion}`) % span;
}

export function workStartGameMinuteForCitizen(
  citizenId: string,
  dayIndex: number,
  policy: FoundationMobilitySchedulePolicy = FOUNDATION_MOBILITY_SCHEDULE_POLICY_V2,
  scheduleSeedVersion = 1,
): number {
  return commuteDepartureGameMinuteForCitizen(citizenId, dayIndex, policy, scheduleSeedVersion);
}

export function commuteDepartureGameMinuteForCitizen(
  citizenId: string,
  dayIndex: number,
  policy: FoundationMobilitySchedulePolicy = FOUNDATION_MOBILITY_SCHEDULE_POLICY_V2,
  scheduleSeedVersion = 1,
): AbsoluteGameMinute {
  assertMobilityId(citizenId);
  assertDayIndex(dayIndex);
  assertScheduleSeedVersion(scheduleSeedVersion);
  const cycleStart = addGameMinutes(
    ZERO_GAME_MINUTE,
    gameMinuteDuration(dayIndex * MINUTES_PER_CYCLE),
  );
  const minuteOfCycle =
    policy.version === 2
      ? stableCommuteBaseMinuteOfDayForCitizen(citizenId, scheduleSeedVersion) +
        v2MorningJitterMinutes(citizenId, dayIndex, scheduleSeedVersion)
      : policy.workStartEarliestMinuteOfDay +
        deterministicScheduleOffset(citizenId, dayIndex, scheduleSeedVersion, policy.version);
  if (minuteOfCycle < 0) throw new MobilityContractError('mobility:invalid-time');
  return addGameMinutes(cycleStart, gameMinuteDuration(minuteOfCycle));
}

export function deriveCitizenScheduleForDay(
  citizen: PresentCitizenMobilityProjection,
  dayIndex: number,
  policy: FoundationMobilitySchedulePolicy = FOUNDATION_MOBILITY_SCHEDULE_POLICY_V2,
  scheduleSeedVersion = 1,
): readonly DueMobilityBoundary[] {
  assertMobilityId(citizen.citizenId);
  assertDayIndex(dayIndex);
  assertScheduleSeedVersion(scheduleSeedVersion);
  const canReuse = Object.isFrozen(citizen) && Object.isFrozen(policy);
  let byPolicy: WeakMap<object, Map<string, readonly DueMobilityBoundary[]>> | undefined;
  let byDay: Map<string, readonly DueMobilityBoundary[]> | undefined;
  const cacheKey = `${dayIndex}|${scheduleSeedVersion}`;
  if (canReuse) {
    byPolicy = DERIVED_SCHEDULE_CACHE.get(citizen);
    if (byPolicy === undefined) {
      byPolicy = new WeakMap();
      DERIVED_SCHEDULE_CACHE.set(citizen, byPolicy);
    }
    byDay = byPolicy.get(policy);
    if (byDay === undefined) {
      byDay = new Map();
      byPolicy.set(policy, byDay);
    }
    const cached = byDay.get(cacheKey);
    if (cached !== undefined) return cached;
  }
  if (!citizen.present || citizen.homeBuildingId === null || citizen.workBuildingId === null) {
    const emptySchedule = Object.freeze([]);
    byDay?.set(cacheKey, emptySchedule);
    return emptySchedule;
  }
  const workStart = commuteDepartureGameMinuteForCitizen(
    citizen.citizenId,
    dayIndex,
    policy,
    scheduleSeedVersion,
  );
  const returnHome =
    policy.version === 2
      ? addGameMinutes(
          ZERO_GAME_MINUTE,
          gameMinuteDuration(
            dayIndex * MINUTES_PER_CYCLE +
              stableCommuteBaseMinuteOfDayForCitizen(citizen.citizenId, scheduleSeedVersion) +
              policy.workDurationMinutes +
              v2ReturnJitterMinutes(citizen.citizenId, dayIndex, scheduleSeedVersion),
          ),
        )
      : addGameMinutes(workStart, gameMinuteDuration(policy.workDurationMinutes));
  const schedule = Object.freeze([
    Object.freeze({
      citizenId: citizen.citizenId,
      atGameMinute: workStart,
      nextActivity: 'Work' as const,
    }),
    Object.freeze({
      citizenId: citizen.citizenId,
      atGameMinute: returnHome,
      nextActivity: 'Home' as const,
    }),
  ]);
  byDay?.set(cacheKey, schedule);
  return schedule;
}
