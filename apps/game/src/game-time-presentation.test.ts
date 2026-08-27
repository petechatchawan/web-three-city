import { createEmptyBuildingSnapshot } from '@web-three-city/building-core';
import {
  absoluteGameMinute,
  createInitialSimulationSnapshot,
  createSimulationSnapshot,
} from '@web-three-city/simulation-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createGameTimePresentation } from './game-time-presentation.js';

describe('Game time presentation', () => {
  it('formats the initial compressed calendar and lifecycle counts', () => {
    expect(
      createGameTimePresentation(
        createInitialSimulationSnapshot(),
        createEmptyBuildingSnapshot(WORLD_CONFIG),
      ),
    ).toEqual({
      calendarLabel: 'Y1 M1 08:00',
      constructionCount: 0,
      activeCount: 0,
      totalCount: 0,
    });
  });

  it.each([
    [1439, 'Y1 M1 23:59'],
    [1440, 'Y1 M2 00:00'],
    [17279, 'Y1 M12 23:59'],
    [17280, 'Y2 M1 00:00'],
  ] as const)('formats calendar boundary minute %i as %s', (minute, calendarLabel) => {
    const simulation = createSimulationSnapshot({
      revision: 0,
      absoluteGameMinute: absoluteGameMinute(minute),
      growthSequence: 0,
    });
    expect(
      createGameTimePresentation(simulation, createEmptyBuildingSnapshot(WORLD_CONFIG))
        .calendarLabel,
    ).toBe(calendarLabel);
  });
});
