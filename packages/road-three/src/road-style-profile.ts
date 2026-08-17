import type { RoadDefinition } from '@web-three-city/road-core';

export interface RoadStyleProfile {
  readonly roadWidth: number;
  readonly centerDividerVisible: boolean;
  readonly centerDividerWidth: number;
  readonly centerDividerColor: Readonly<{ r: number; g: number; b: number }>;
  readonly markingSurfaceOffset: number;
}

const CENTER_DIVIDER_COLOR = Object.freeze({ r: 0.92, g: 0.88, b: 0.68 });
const CENTER_DIVIDER_WIDTH_RATIO = 0.05;
const MAX_CENTER_DIVIDER_WIDTH = 0.04;
const MARKING_SURFACE_OFFSET = 0.004;

export function roadStyleProfileForDefinition(definition: RoadDefinition): RoadStyleProfile {
  return Object.freeze({
    roadWidth: definition.width,
    centerDividerVisible: true,
    centerDividerWidth: Math.min(
      MAX_CENTER_DIVIDER_WIDTH,
      definition.width * CENTER_DIVIDER_WIDTH_RATIO,
    ),
    centerDividerColor: CENTER_DIVIDER_COLOR,
    markingSurfaceOffset: MARKING_SURFACE_OFFSET,
  });
}
