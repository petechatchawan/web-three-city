import type { TerrainShape } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';
import type { RoadInvalidReason } from '../src/index.js';

export type RoadFixtureDirection = 'north' | 'east' | 'south' | 'west';

export interface RoadDeterministicFixtureCase {
  readonly id: string;
  readonly cells: readonly CellCoord[];
  readonly focusCell: CellCoord;
  readonly shapes?: Readonly<Record<string, TerrainShape>>;
  readonly wetCellKeys?: readonly string[];
  readonly expectedValid: boolean;
  readonly expectedInvalidReason: RoadInvalidReason | null;
  readonly expectedConnections?: readonly RoadFixtureDirection[];
  readonly minimumDirtyChunkCount?: number;
}

// RED scaffold: PR-T3.2 must populate the complete 24-case replacement matrix
// before any corresponding Playwright fixture enumeration is narrowed.
export const ROAD_DETERMINISTIC_FIXTURE_CASES: readonly RoadDeterministicFixtureCase[] =
  Object.freeze([]);
