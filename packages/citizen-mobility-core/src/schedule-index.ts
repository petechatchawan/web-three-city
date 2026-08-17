import { compareMobilityId, type PresentCitizenMobilityProjection } from './contracts.js';
import { MobilityContractError } from './errors.js';
import {
  FOUNDATION_MOBILITY_SCHEDULE_POLICY_V1,
  deriveCitizenScheduleForDay,
  type DueMobilityBoundary,
  type FoundationMobilitySchedulePolicyV1,
} from './schedule-policy.js';

function activityPriority(activity: DueMobilityBoundary['nextActivity']): number {
  return activity === 'Work' ? 0 : 1;
}

export function collectDueMobilityBoundaries(
  input: Readonly<{
    citizens: readonly PresentCitizenMobilityProjection[];
    fromGameMinuteExclusive: number;
    toGameMinuteInclusive: number;
    policy?: FoundationMobilitySchedulePolicyV1;
    scheduleSeedVersion?: number;
  }>,
): readonly DueMobilityBoundary[] {
  const { fromGameMinuteExclusive, toGameMinuteInclusive } = input;
  if (
    !Number.isSafeInteger(fromGameMinuteExclusive) ||
    !Number.isSafeInteger(toGameMinuteInclusive) ||
    fromGameMinuteExclusive < -1 ||
    toGameMinuteInclusive < 0 ||
    toGameMinuteInclusive < fromGameMinuteExclusive
  ) {
    throw new MobilityContractError('mobility:invalid-time');
  }

  const policy = input.policy ?? FOUNDATION_MOBILITY_SCHEDULE_POLICY_V1;
  const seedVersion = input.scheduleSeedVersion ?? 1;
  const firstMinute = Math.max(0, fromGameMinuteExclusive + 1);
  const firstDay = Math.floor(firstMinute / 1440);
  const lastDay = Math.floor(toGameMinuteInclusive / 1440);
  const boundaries: DueMobilityBoundary[] = [];

  for (let dayIndex = firstDay; dayIndex <= lastDay; dayIndex += 1) {
    for (const citizen of input.citizens) {
      for (const boundary of deriveCitizenScheduleForDay(citizen, dayIndex, policy, seedVersion)) {
        if (
          boundary.atGameMinute > fromGameMinuteExclusive &&
          boundary.atGameMinute <= toGameMinuteInclusive
        ) {
          boundaries.push(boundary);
        }
      }
    }
  }

  boundaries.sort((first, second) =>
    first.atGameMinute !== second.atGameMinute
      ? first.atGameMinute - second.atGameMinute
      : activityPriority(first.nextActivity) !== activityPriority(second.nextActivity)
        ? activityPriority(first.nextActivity) - activityPriority(second.nextActivity)
        : compareMobilityId(first.citizenId, second.citizenId),
  );
  return Object.freeze(boundaries.map((boundary) => Object.freeze({ ...boundary })));
}
