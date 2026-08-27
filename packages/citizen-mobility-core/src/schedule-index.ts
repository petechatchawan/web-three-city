import { compareMobilityId, type PresentCitizenMobilityProjection } from './contracts.js';
import { MobilityContractError } from './errors.js';
import {
  FOUNDATION_MOBILITY_SCHEDULE_POLICY_V2,
  deriveCitizenScheduleForDay,
  type DueMobilityBoundary,
  type FoundationMobilitySchedulePolicy,
} from './schedule-policy.js';
import {
  compareGameMinutes,
  gameMinuteValue,
  type AbsoluteGameMinute,
} from '@web-three-city/simulation-core';

type MobilityBoundaryCursor = AbsoluteGameMinute | -1;

function activityPriority(activity: DueMobilityBoundary['nextActivity']): number {
  return activity === 'Work' ? 0 : 1;
}

export function collectDueMobilityBoundaries(
  input: Readonly<{
    citizens: readonly PresentCitizenMobilityProjection[];
    fromGameMinuteExclusive: MobilityBoundaryCursor;
    toGameMinuteInclusive: AbsoluteGameMinute;
    policy?: FoundationMobilitySchedulePolicy;
    scheduleSeedVersion?: number;
  }>,
): readonly DueMobilityBoundary[] {
  const { fromGameMinuteExclusive, toGameMinuteInclusive } = input;
  const fromGameMinuteValue =
    fromGameMinuteExclusive === -1 ? -1 : gameMinuteValue(fromGameMinuteExclusive);
  const toGameMinuteValue = gameMinuteValue(toGameMinuteInclusive);
  if (
    !Number.isSafeInteger(fromGameMinuteValue) ||
    !Number.isSafeInteger(toGameMinuteValue) ||
    fromGameMinuteValue < -1 ||
    toGameMinuteValue < 0 ||
    toGameMinuteValue < fromGameMinuteValue
  ) {
    throw new MobilityContractError('mobility:invalid-time');
  }

  const policy = input.policy ?? FOUNDATION_MOBILITY_SCHEDULE_POLICY_V2;
  const seedVersion = input.scheduleSeedVersion ?? 1;
  const firstMinute = Math.max(0, fromGameMinuteValue + 1);
  const firstDay = Math.floor(firstMinute / 1440);
  const lastDay = Math.floor(toGameMinuteValue / 1440);
  const boundaries: DueMobilityBoundary[] = [];

  for (let dayIndex = firstDay; dayIndex <= lastDay; dayIndex += 1) {
    for (const citizen of input.citizens) {
      for (const boundary of deriveCitizenScheduleForDay(citizen, dayIndex, policy, seedVersion)) {
        if (
          (fromGameMinuteExclusive === -1 ||
            compareGameMinutes(boundary.atGameMinute, fromGameMinuteExclusive) > 0) &&
          compareGameMinutes(boundary.atGameMinute, toGameMinuteInclusive) <= 0
        ) {
          boundaries.push(boundary);
        }
      }
    }
  }

  boundaries.sort((first, second) =>
    gameMinuteValue(first.atGameMinute) !== gameMinuteValue(second.atGameMinute)
      ? gameMinuteValue(first.atGameMinute) - gameMinuteValue(second.atGameMinute)
      : activityPriority(first.nextActivity) !== activityPriority(second.nextActivity)
        ? activityPriority(first.nextActivity) - activityPriority(second.nextActivity)
        : compareMobilityId(first.citizenId, second.citizenId),
  );
  return Object.freeze(boundaries.map((boundary) => Object.freeze({ ...boundary })));
}
