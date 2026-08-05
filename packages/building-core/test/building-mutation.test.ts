import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  BuildingContractError,
  buildingAtCell,
  commitBuildingMutation,
  createEmptyBuildingSnapshot,
  occupiedCellsForBuilding,
  planBuildingBulldoze,
  planBuildingDevelopment,
  type BuildingDevelopmentEnvironment,
} from '../src/index.js';

const CONFIG: WorldConfig = Object.freeze({
  mapWidth: 6,
  mapHeight: 6,
  chunkSize: 3,
  cellSize: 1,
  heightStep: 0.5,
  minHeightLevel: 0,
  maxHeightLevel: 4,
  seaLevel: 1,
  dioramaBaseY: -1.5,
});
const FLAT = Object.freeze({
  cell: Object.freeze({ x: 0, z: 0 }),
  corners: Object.freeze({ nw: 2, ne: 2, sw: 2, se: 2 }),
  shape: 'flat',
  minimumLevel: 2,
  maximumLevel: 2,
  slopeAxis: null,
}) as TerrainCellSurfaceProfile;

function environment(
  overrides: Partial<BuildingDevelopmentEnvironment> = {},
): BuildingDevelopmentEnvironment {
  return Object.freeze({
    terrainRevision: 5,
    waterSourceTerrainRevision: 5,
    roadRevision: 2,
    zoneRevision: 7,
    surfaceAt: () => FLAT,
    isDry: () => true,
    isRoadOccupied: () => false,
    zoneDefinitionIdAt(cell: CellCoord) {
      return cell.x >= 1 && cell.x <= 2 && cell.z >= 1 && cell.z <= 2 ? 'commercial' : null;
    },
    roadAccessAt(cell: CellCoord) {
      return cell.z === 1
        ? Object.freeze({
            direction: 'north',
            distance: 1,
            roadCell: Object.freeze({ x: cell.x, z: 0 }),
          })
        : null;
    },
    ...overrides,
  });
}

describe('building mutation', () => {
  it('selects the highest-priority compatible footprint deterministically and commits atomically', () => {
    const before = createEmptyBuildingSnapshot(CONFIG);
    const plan = planBuildingDevelopment(before, environment(), CONFIG);
    expect(plan.valid).toBe(true);
    expect(plan.addedInstances).toHaveLength(1);
    expect(plan.addedInstances[0]).toMatchObject({
      instanceId: 'building:1:1',
      buildingDefinitionId: 'commercial-office-2x2',
      originCell: { x: 1, z: 1 },
      rotationQuarterTurns: 2,
    });
    const committed = commitBuildingMutation(before, plan, environment(), CONFIG);
    expect(committed.snapshot.revision).toBe(1);
    expect(committed.receipt.addedCellCount).toBe(4);
  });

  it('persists the rotation whose canonical entrance faces deterministic frontage', () => {
    const before = createEmptyBuildingSnapshot(CONFIG);
    const plan = planBuildingDevelopment(before, environment(), CONFIG);

    expect(plan.addedInstances[0]?.rotationQuarterTurns).toBe(2);
  });

  it('bulldozes the whole instance selected by any occupied cell', () => {
    const before = createEmptyBuildingSnapshot(CONFIG);
    const developed = commitBuildingMutation(
      before,
      planBuildingDevelopment(before, environment(), CONFIG),
      environment(),
      CONFIG,
    ).snapshot;
    const plan = planBuildingBulldoze(developed, { x: 2, z: 2 }, environment(), CONFIG);
    expect(plan.removedInstances[0]?.buildingDefinitionId).toBe('commercial-office-2x2');
    const after = commitBuildingMutation(developed, plan, environment(), CONFIG).snapshot;
    expect(buildingAtCell(after, { x: 1, z: 1 })).toBeNull();
  });

  it('discards every accepted lot when an environment accessor fails mid-scan', () => {
    const before = createEmptyBuildingSnapshot(CONFIG);
    const unstable = environment({
      zoneDefinitionIdAt(cell: CellCoord) {
        if (cell.z === 1 && cell.x === 3) throw new Error('environment unavailable');
        return cell.x >= 1 && cell.x <= 2 && cell.z >= 1 && cell.z <= 2 ? 'commercial' : null;
      },
    });

    const plan = planBuildingDevelopment(before, unstable, CONFIG);

    expect(plan).toMatchObject({
      valid: false,
      invalidReason: 'building:invalid-environment',
      proposedInstances: [],
      addedInstances: [],
      dirtyChunks: [],
    });
  });

  it('never spans mixed Zones and still develops compatible sub-lots', () => {
    const before = createEmptyBuildingSnapshot(CONFIG);
    const mixed = environment({
      zoneDefinitionIdAt(cell: CellCoord) {
        if (cell.x === 1 && cell.z === 1) return 'commercial';
        if (cell.x === 2 && cell.z === 1) return 'residential';
        return null;
      },
    });

    const plan = planBuildingDevelopment(before, mixed, CONFIG);

    expect(plan.valid).toBe(true);
    expect(plan.addedInstances.map((instance) => instance.buildingDefinitionId)).toEqual([
      'commercial-cafe-1x1',
      'residential-cottage-1x1',
    ]);
    for (const instance of plan.addedInstances) {
      const zoneIds = new Set(
        occupiedCellsForBuilding(instance).map((cell) => mixed.zoneDefinitionIdAt(cell)),
      );
      expect(zoneIds.size).toBe(1);
    }
  });

  it('rejects stale source revisions', () => {
    const before = createEmptyBuildingSnapshot(CONFIG);
    const plan = planBuildingDevelopment(before, environment(), CONFIG);
    expect(() =>
      commitBuildingMutation(before, plan, environment({ roadRevision: 3 }), CONFIG),
    ).toThrowError(new BuildingContractError('building:stale-road-plan'));
  });
});
