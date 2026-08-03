import { describe, expect, it } from 'vitest';
import {
  isBuildingToolMode,
  isRoadToolMode,
  isTerraformToolMode,
  isZoneToolMode,
  type GameToolMode,
} from './game-tool-mode.js';

const MODES: readonly GameToolMode[] = Object.freeze([
  'navigate',
  'raise',
  'lower',
  'flatten',
  'road-build',
  'road-bulldoze',
  'zone-residential',
  'zone-commercial',
  'zone-industrial',
  'zone-remove',
  'building-develop',
  'building-bulldoze',
]);

describe('Building tool modes', () => {
  it('narrows only the two Building operations', () => {
    expect(MODES.filter(isBuildingToolMode)).toEqual([
      'building-develop',
      'building-bulldoze',
    ]);
  });

  it('keeps Building modes isolated from Terrain, Road, and Zone domains', () => {
    for (const mode of ['building-develop', 'building-bulldoze'] as const) {
      expect(isTerraformToolMode(mode)).toBe(false);
      expect(isRoadToolMode(mode)).toBe(false);
      expect(isZoneToolMode(mode)).toBe(false);
    }
  });
});
