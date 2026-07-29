import type { WorldToolMode } from '@web-three-city/terrain-core';

export type RoadToolMode = 'road-build' | 'road-bulldoze';
export type GameToolMode = WorldToolMode | RoadToolMode;

export function isRoadToolMode(mode: GameToolMode): mode is RoadToolMode {
  return mode === 'road-build' || mode === 'road-bulldoze';
}

export function isTerraformToolMode(
  mode: GameToolMode,
): mode is Exclude<WorldToolMode, 'navigate'> {
  return mode === 'raise' || mode === 'lower' || mode === 'flatten';
}
