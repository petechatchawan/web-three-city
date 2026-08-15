import { createFoundationRciRegistries } from '@web-three-city/rci-core';
import { afterEach, describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../../../test/application-fixtures.js';
import { createInspectProjection } from './inspect-projections.js';
import { mountInspectSurface } from './inspect-surface.js';

afterEach(() => document.body.replaceChildren());

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

  it('localizes Inspect field labels in presentation without mutating the projection', () => {
    const projection = createInspectProjection(
      createApplicationFixture(),
      { kind: 'terrain', cell: { x: 8, z: 8 } },
      createFoundationRciRegistries(),
    );
    const original = JSON.stringify(projection);
    const surface = mountInspectSurface(document.body, 'en');
    surface.open(projection);
    surface.element
      .querySelector<HTMLButtonElement>('[aria-label="Expand Inspect"]')!
      .click();

    expect(surface.element.textContent).toContain('Cell');
    expect(surface.element.textContent).toContain('Water');
    surface.setLocale('th');
    expect(surface.element.textContent).toContain('ช่อง');
    expect(surface.element.textContent).toContain('น้ำ');
    expect(JSON.stringify(projection)).toBe(original);
  });
});
