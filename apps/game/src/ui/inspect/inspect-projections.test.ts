import { createFoundationRciRegistries } from '@web-three-city/rci-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../../../test/application-fixtures.js';
import { createInspectProjection } from './inspect-projections.js';

describe('inspect projections', () => {
  it('does not fall through to a lower-priority target when a Building disappears', () => {
    const target = { kind: 'building', cell: { x: 4, z: 4 } } as const;
    const projection = createInspectProjection(
      createApplicationFixture(),
      target,
      createFoundationRciRegistries(),
    );
    expect(projection).toEqual({ kind: 'unavailable', title: 'Unavailable' });
  });

  it('creates player-safe Terrain information without revisions or IDs', () => {
    const projection = createInspectProjection(
      createApplicationFixture(),
      { kind: 'terrain', cell: { x: 8, z: 8 } },
      createFoundationRciRegistries(),
    );
    expect(projection.kind).toBe('terrain');
    expect(JSON.stringify(projection)).not.toMatch(/revision|fingerprint|instanceId/);
  });
});
