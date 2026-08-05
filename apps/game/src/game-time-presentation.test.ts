import { createEmptyBuildingSnapshot } from '@web-three-city/building-core';
import { createInitialSimulationSnapshot } from '@web-three-city/simulation-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createGameTimePresentation } from './game-time-presentation.js';

describe('Game time presentation', () => {
  it('formats the initial simple calendar and lifecycle counts', () => {
    expect(
      createGameTimePresentation(
        createInitialSimulationSnapshot(),
        createEmptyBuildingSnapshot(WORLD_CONFIG),
      ),
    ).toEqual({
      calendarLabel: 'Y1 M1 D1 08:00',
      constructionCount: 0,
      activeCount: 0,
      totalCount: 0,
    });
  });
});
