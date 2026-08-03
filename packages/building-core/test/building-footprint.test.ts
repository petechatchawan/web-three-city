import { describe, expect, it } from 'vitest';
import {
  buildingDefinitionForId,
  occupiedCellsForBuilding,
  rotatedBuildingFootprint,
  type BuildingInstance,
} from '../src/index.js';

const INSTANCE: BuildingInstance = Object.freeze({
  instanceId: 'building:1:1',
  buildingDefinitionId: 'residential-rowhouse-1x2',
  buildingDefinitionVersion: 1,
  originCell: Object.freeze({ x: 4, z: 6 }),
  rotationQuarterTurns: 0,
});

describe('building footprint', () => {
  it('swaps canonical dimensions on odd quarter turns', () => {
    const definition = buildingDefinitionForId('residential-rowhouse-1x2');
    expect(rotatedBuildingFootprint(definition, 0)).toEqual({ width: 1, depth: 2 });
    expect(rotatedBuildingFootprint(definition, 1)).toEqual({ width: 2, depth: 1 });
    expect(rotatedBuildingFootprint(definition, 2)).toEqual({ width: 1, depth: 2 });
    expect(rotatedBuildingFootprint(definition, 3)).toEqual({ width: 2, depth: 1 });
  });

  it('derives occupied cells in deterministic row-major order', () => {
    expect(occupiedCellsForBuilding(INSTANCE)).toEqual([
      { x: 4, z: 6 },
      { x: 4, z: 7 },
    ]);
    expect(
      occupiedCellsForBuilding(Object.freeze({ ...INSTANCE, rotationQuarterTurns: 1 })),
    ).toEqual([
      { x: 4, z: 6 },
      { x: 5, z: 6 },
    ]);
  });
});
