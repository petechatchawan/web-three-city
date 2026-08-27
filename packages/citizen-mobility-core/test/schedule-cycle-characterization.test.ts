import { describe, expect, it } from 'vitest';
import {
  collectDueMobilityBoundaries,
  commuteDepartureGameMinuteForCitizen,
  deriveCitizenScheduleForDay,
} from '../src/index.js';

const MINUTES_PER_CYCLE = 24 * 60;
const citizen = Object.freeze({
  citizenId: 'schedule-cycle-characterization',
  homeBuildingId: 'home-1',
  workBuildingId: 'work-1',
  present: true,
});

function minuteOfCycle(gameMinute: number): number {
  return gameMinute % MINUTES_PER_CYCLE;
}

function citizenDepartingAt(minuteOfDay: number): string {
  for (let index = 0; index < 50_000; index += 1) {
    const citizenId = `schedule-boundary-citizen-${index}`;
    if (minuteOfCycle(commuteDepartureGameMinuteForCitizen(citizenId, 0)) === minuteOfDay) {
      return citizenId;
    }
  }
  throw new Error(`test-fixture:no-citizen-departs-at-${minuteOfDay}`);
}

describe('Mobility schedule cycle characterization', () => {
  it('emits the morning commute exactly when 07:59 advances to 08:00', () => {
    const citizenId = citizenDepartingAt(8 * 60);
    const due = collectDueMobilityBoundaries({
      citizens: [Object.freeze({ ...citizen, citizenId })],
      fromGameMinuteExclusive: 7 * 60 + 59,
      toGameMinuteInclusive: 8 * 60,
    });

    expect(due).toEqual([
      {
        citizenId,
        atGameMinute: 8 * 60,
        nextActivity: 'Work',
      },
    ]);
  });

  it('keeps morning departure and return-home as distinct same-cycle boundaries', () => {
    const [departure, returnHome] = deriveCitizenScheduleForDay(citizen, 0);
    expect(departure).toMatchObject({ citizenId: citizen.citizenId, nextActivity: 'Work' });
    expect(returnHome).toMatchObject({ citizenId: citizen.citizenId, nextActivity: 'Home' });
    expect(departure!.atGameMinute).toBeGreaterThanOrEqual(7 * 60);
    expect(departure!.atGameMinute).toBeLessThanOrEqual(9 * 60);
    expect(returnHome!.atGameMinute).toBeGreaterThan(departure!.atGameMinute);

    expect(
      collectDueMobilityBoundaries({
        citizens: [citizen],
        fromGameMinuteExclusive: departure!.atGameMinute - 1,
        toGameMinuteInclusive: departure!.atGameMinute,
      }),
    ).toEqual([departure]);
    expect(
      collectDueMobilityBoundaries({
        citizens: [citizen],
        fromGameMinuteExclusive: returnHome!.atGameMinute - 1,
        toGameMinuteInclusive: returnHome!.atGameMinute,
      }),
    ).toEqual([returnHome]);
  });

  it('preserves the daily schedule across the 23:59 to 00:00 cycle boundary', () => {
    const dayZero = deriveCitizenScheduleForDay(citizen, 0);
    const dayOne = deriveCitizenScheduleForDay(citizen, 1);

    expect(
      collectDueMobilityBoundaries({
        citizens: [citizen],
        fromGameMinuteExclusive: 23 * 60 + 59,
        toGameMinuteInclusive: MINUTES_PER_CYCLE,
      }),
    ).toEqual([]);

    expect(dayZero.every((boundary) => boundary.atGameMinute < MINUTES_PER_CYCLE)).toBe(true);
    expect(dayOne.every((boundary) => boundary.atGameMinute >= MINUTES_PER_CYCLE)).toBe(true);
    expect(dayOne.map((boundary) => minuteOfCycle(boundary.atGameMinute))).toEqual(
      expect.arrayContaining([expect.any(Number), expect.any(Number)]),
    );
    expect(minuteOfCycle(dayOne[0]!.atGameMinute)).toBeGreaterThanOrEqual(7 * 60);
    expect(minuteOfCycle(dayOne[0]!.atGameMinute)).toBeLessThanOrEqual(9 * 60);

    const nextCycleDeparture = collectDueMobilityBoundaries({
      citizens: [citizen],
      fromGameMinuteExclusive: MINUTES_PER_CYCLE - 1,
      toGameMinuteInclusive: dayOne[0]!.atGameMinute,
    }).find((boundary) => boundary.nextActivity === 'Work');
    expect(nextCycleDeparture).toEqual(dayOne[0]);
  });
});
