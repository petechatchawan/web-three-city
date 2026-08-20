import { describe, expect, it } from 'vitest';
import {
  FOUNDATION_MOBILITY_SCHEDULE_POLICY_V1,
  FOUNDATION_MOBILITY_SCHEDULE_POLICY_V2,
  collectDueMobilityBoundaries,
  commuteDepartureGameMinuteForCitizen,
  deriveCitizenScheduleForDay,
  stableCommuteBaseMinuteOfDayForCitizen,
  workStartGameMinuteForCitizen,
} from '../src/index.js';

const citizen = Object.freeze({
  citizenId: 'citizen-schedule-v2',
  homeBuildingId: 'home-1',
  workBuildingId: 'work-1',
  present: true,
});

function minuteOfDay(gameMinute: number): number {
  return gameMinute % 1440;
}

describe('Mobility schedule policy V2', () => {
  it('keeps a Citizen personal base stable while deterministic morning jitter varies by day', () => {
    const base = stableCommuteBaseMinuteOfDayForCitizen(citizen.citizenId);
    const departures = Array.from({ length: 14 }, (_, dayIndex) =>
      minuteOfDay(commuteDepartureGameMinuteForCitizen(citizen.citizenId, dayIndex)),
    );

    expect(base).toBeGreaterThanOrEqual(425);
    expect(base).toBeLessThanOrEqual(534);
    expect(new Set(departures).size).toBeGreaterThan(1);
    for (const departure of departures) {
      expect(departure).toBeGreaterThanOrEqual(base - 5);
      expect(departure).toBeLessThanOrEqual(base + 5);
    }
  });

  it('uses the configured deterministic weighted morning buckets', () => {
    const counts = [0, 0, 0, 0];
    for (let citizenIndex = 0; citizenIndex < 10_000; citizenIndex += 1) {
      const base = stableCommuteBaseMinuteOfDayForCitizen(`weighted-citizen-${citizenIndex}`);
      counts[base < 450 ? 0 : base < 480 ? 1 : base < 510 ? 2 : 3]! += 1;
    }

    expect(counts[0]).toBeGreaterThanOrEqual(1_400);
    expect(counts[0]).toBeLessThanOrEqual(1_600);
    expect(counts[1]).toBeGreaterThanOrEqual(2_900);
    expect(counts[1]).toBeLessThanOrEqual(3_100);
    expect(counts[2]).toBeGreaterThanOrEqual(3_400);
    expect(counts[2]).toBeLessThanOrEqual(3_600);
    expect(counts[3]).toBeGreaterThanOrEqual(1_900);
    expect(counts[3]).toBeLessThanOrEqual(2_100);
  });

  it('keeps every representative departure and work interval within V2 bounds', () => {
    for (let citizenIndex = 0; citizenIndex < 200; citizenIndex += 1) {
      const projection = Object.freeze({ ...citizen, citizenId: `sample-citizen-${citizenIndex}` });
      for (let dayIndex = 0; dayIndex < 32; dayIndex += 1) {
        const [departure, returnHome] = deriveCitizenScheduleForDay(projection, dayIndex);
        expect(minuteOfDay(departure!.atGameMinute)).toBeGreaterThanOrEqual(420);
        expect(minuteOfDay(departure!.atGameMinute)).toBeLessThanOrEqual(539);
        expect(returnHome!.atGameMinute - departure!.atGameMinute).toBeGreaterThanOrEqual(525);
        expect(returnHome!.atGameMinute - departure!.atGameMinute).toBeLessThanOrEqual(555);
      }
    }
  });

  it('does not let Citizen array iteration order change a V2 schedule', () => {
    const citizens = Object.freeze([
      citizen,
      Object.freeze({ ...citizen, citizenId: 'citizen-schedule-v2-b' }),
      Object.freeze({ ...citizen, citizenId: 'citizen-schedule-v2-c' }),
    ]);
    const input = {
      fromGameMinuteExclusive: 6 * 60,
      toGameMinuteInclusive: 20 * 60,
    };

    expect(collectDueMobilityBoundaries({ ...input, citizens })).toEqual(
      collectDueMobilityBoundaries({ ...input, citizens: [...citizens].reverse() }),
    );
  });

  it('keeps explicit V1 policy scheduling and its legacy helper available', () => {
    const v1Departure = commuteDepartureGameMinuteForCitizen(
      citizen.citizenId,
      3,
      FOUNDATION_MOBILITY_SCHEDULE_POLICY_V1,
    );

    expect(FOUNDATION_MOBILITY_SCHEDULE_POLICY_V2.version).toBe(2);
    expect(workStartGameMinuteForCitizen(citizen.citizenId, 3)).toBe(
      commuteDepartureGameMinuteForCitizen(citizen.citizenId, 3),
    );
    expect(minuteOfDay(v1Departure)).toBeGreaterThanOrEqual(420);
    expect(minuteOfDay(v1Departure)).toBeLessThanOrEqual(540);
  });
});
