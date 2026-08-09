import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../../../test/application-fixtures.js';
import { pickInspectTarget } from './inspect-target.js';

describe('inspect target priority', () => {
  it('selects Building before Zone, then Road, then Terrain', () => {
    const withBuilding = createApplicationFixture({ withCommercialBuilding: true });
    expect(pickInspectTarget(withBuilding, { x: 4, z: 4 }).kind).toBe('building');
    expect(pickInspectTarget(withBuilding, { x: 4, z: 3 }).kind).toBe('road');
    const withoutBuilding = createApplicationFixture();
    expect(pickInspectTarget(withoutBuilding, { x: 4, z: 4 }).kind).toBe('zone');
    expect(pickInspectTarget(withoutBuilding, { x: 8, z: 8 }).kind).toBe('terrain');
  });
});
