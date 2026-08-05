import { describe, expect, it } from 'vitest';
import {
  isBuildingToolMode,
  isGameToolMode,
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
  'building-bulldoze',
]);

describe('Building tool modes', () => {
  it('exposes only interactive Building bulldoze', () => {
    expect(MODES.filter(isBuildingToolMode)).toEqual(['building-bulldoze']);
    expect(isGameToolMode('building-develop')).toBe(false);
  });

  it('keeps Building bulldoze isolated from Terrain, Road, and Zone domains', () => {
    expect(isTerraformToolMode('building-bulldoze')).toBe(false);
    expect(isRoadToolMode('building-bulldoze')).toBe(false);
    expect(isZoneToolMode('building-bulldoze')).toBe(false);
  });
});
