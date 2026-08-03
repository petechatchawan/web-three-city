import { describe, expect, it } from 'vitest';
import type { WorldConfig } from '@web-three-city/world-core';
import {
  buildingAtCell,
  buildingCount,
  createBuildingSnapshot,
  occupiedBuildingCellCount,
  type BuildingInstance,
} from '../src/index.js';

const CONFIG: WorldConfig = Object.freeze({
  mapWidth: 8,
  mapHeight: 8,
  chunkSize: 4,
  cellSize: 1,
  heightStep: 0.5,
  minHeightLevel: 0,
  maxHeightLevel: 4,
  seaLevel: 1,
  dioramaBaseY: -1.5,
});

function instance(id: string, x: number, z: number): BuildingInstance {
  return Object.freeze({
    instanceId: id,
    buildingDefinitionId: 'commercial-office-2x2',
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ x, z }),
    rotationQuarterTurns: 0,
  });
}

describe('building snapshot', () => {
  it('owns a defensive immutable instance list and derived occupancy index', () => {
    const source = [instance('b:1', 1, 1)];
    const snapshot = createBuildingSnapshot({ revision: 3, instances: source }, CONFIG);
    source.length = 0;
    expect(buildingCount(snapshot)).toBe(1);
    expect(occupiedBuildingCellCount(snapshot)).toBe(4);
    expect(buildingAtCell(snapshot, { x: 2, z: 2 })?.instanceId).toBe('b:1');
    expect(Object.isFrozen(snapshot.instances[0]?.originCell)).toBe(true);
  });

  it('rejects duplicate IDs, overlaps, and out-of-bounds footprints', () => {
    expect(() =>
      createBuildingSnapshot({ revision: 0, instances: [instance('x', 0, 0), instance('x', 4, 4)] }, CONFIG),
    ).toThrow('building-snapshot:duplicate-instance-id');
    expect(() =>
      createBuildingSnapshot({ revision: 0, instances: [instance('x', 0, 0), instance('y', 1, 1)] }, CONFIG),
    ).toThrow('building-snapshot:overlapping-footprint');
    expect(() =>
      createBuildingSnapshot({ revision: 0, instances: [instance('x', 7, 7)] }, CONFIG),
    ).toThrow('building-snapshot:footprint-out-of-bounds');
  });
});
