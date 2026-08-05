import type { WorldToolMode } from '@web-three-city/terrain-core';

export type RoadToolMode = 'road-build' | 'road-bulldoze';
export type ZoneToolMode =
  'zone-residential' | 'zone-commercial' | 'zone-industrial' | 'zone-remove';
export type BuildingToolMode = 'building-bulldoze';
export type GameToolMode = WorldToolMode | RoadToolMode | ZoneToolMode | BuildingToolMode;

export function isGameToolMode(mode: string): mode is GameToolMode {
  return (
    mode === 'navigate' ||
    mode === 'raise' ||
    mode === 'lower' ||
    mode === 'flatten' ||
    mode === 'road-build' ||
    mode === 'road-bulldoze' ||
    mode === 'zone-residential' ||
    mode === 'zone-commercial' ||
    mode === 'zone-industrial' ||
    mode === 'zone-remove' ||
    mode === 'building-bulldoze'
  );
}

export function isRoadToolMode(mode: GameToolMode): mode is RoadToolMode {
  return mode === 'road-build' || mode === 'road-bulldoze';
}

export function isZoneToolMode(mode: GameToolMode): mode is ZoneToolMode {
  return (
    mode === 'zone-residential' ||
    mode === 'zone-commercial' ||
    mode === 'zone-industrial' ||
    mode === 'zone-remove'
  );
}

export function isBuildingToolMode(mode: GameToolMode): mode is BuildingToolMode {
  return mode === 'building-bulldoze';
}

export function isTerraformToolMode(
  mode: GameToolMode,
): mode is Exclude<WorldToolMode, 'navigate'> {
  return mode === 'raise' || mode === 'lower' || mode === 'flatten';
}
