import { addGameMinutes, gameMinuteDuration } from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../../test/application-fixtures.js';
import { staticPresentationNeedsRebuild } from './static-presentation-refresh.js';

describe('static presentation refresh policy', () => {
  it('does not rebuild for a dynamic-only committed publication', () => {
    const initial = createApplicationFixture();
    const dynamicOnly = Object.freeze({
      ...initial,
      revision: initial.revision + 1,
      simulation: Object.freeze({
        ...initial.simulation,
        revision: initial.simulation.revision + 1,
        absoluteGameMinute: addGameMinutes(
          initial.simulation.absoluteGameMinute,
          gameMinuteDuration(1),
        ),
      }),
    });

    expect(staticPresentationNeedsRebuild(initial, dynamicOnly)).toBe(false);
  });

  it('rebuilds when a static authority reference changes', () => {
    const initial = createApplicationFixture();
    const changed = createApplicationFixture({ applicationRevision: 1 });

    expect(staticPresentationNeedsRebuild(initial, changed)).toBe(true);
  });
});
