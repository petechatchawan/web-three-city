import { describe, expect, it } from 'vitest';
import { absoluteGameMinute } from '@web-three-city/simulation-core';
import {
  collectDueMobilityBoundaries,
  createEmptyMobilitySnapshot,
  reconcileMobilityCitizens,
} from '../src/index.js';

describe('Citizen Mobility production scale', () => {
  it('reconciles 20,000 logical Citizens without creating render authority', () => {
    const citizens = Array.from({ length: 20_000 }, (_, index) =>
      Object.freeze({
        citizenId: `citizen-${String(index).padStart(5, '0')}`,
        homeBuildingId: `home-${index % 1000}`,
        workBuildingId: `work-${index % 500}`,
        present: true,
      }),
    );
    const result = reconcileMobilityCitizens({
      snapshot: createEmptyMobilitySnapshot(),
      citizens,
    });
    expect(result.snapshot.citizenStates).toHaveLength(20_000);
    expect(result.snapshot.trips).toHaveLength(0);
    expect(JSON.stringify(result.snapshot)).not.toContain('mesh');
    expect(JSON.stringify(result.snapshot)).not.toContain('position');
  });

  it('indexes due commute boundaries without synchronizing every Citizen to one minute', () => {
    const citizens = Array.from({ length: 20_000 }, (_, index) =>
      Object.freeze({
        citizenId: `citizen-${String(index).padStart(5, '0')}`,
        homeBuildingId: 'home-1',
        workBuildingId: 'work-1',
        present: true,
      }),
    );
    const due = collectDueMobilityBoundaries({
      citizens,
      fromGameMinuteExclusive: absoluteGameMinute(6 * 60),
      toGameMinuteInclusive: absoluteGameMinute(10 * 60),
    });
    expect(due).toHaveLength(20_000);
    expect(new Set(due.map((boundary) => boundary.atGameMinute)).size).toBeGreaterThan(60);
  });
});
