import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  createBuildingSnapshot,
  fingerprintBuildingSnapshot,
  type ActiveBuildingInstance,
} from '../src/index.js';

function active(instanceId: string, x: number, z: number): ActiveBuildingInstance {
  return Object.freeze({
    instanceId,
    buildingDefinitionId: 'residential-cottage-1x1',
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ x, z }),
    rotationQuarterTurns: 0,
    lifecycle: 'active',
    activatedAtTick: 24,
  });
}

describe('fingerprintBuildingSnapshot', () => {
  it('canonicalizes revision and every authoritative instance field in stable id order', () => {
    const first = createBuildingSnapshot(
      { revision: 7, instances: [active('building:2', 4, 4), active('building:1', 2, 2)] },
      WORLD_CONFIG,
    );
    const same = createBuildingSnapshot(
      { revision: 7, instances: [active('building:1', 2, 2), active('building:2', 4, 4)] },
      WORLD_CONFIG,
    );
    const moved = createBuildingSnapshot(
      { revision: 7, instances: [active('building:1', 3, 2), active('building:2', 4, 4)] },
      WORLD_CONFIG,
    );

    expect(fingerprintBuildingSnapshot(first)).toBe(fingerprintBuildingSnapshot(same));
    expect(fingerprintBuildingSnapshot(moved)).not.toBe(fingerprintBuildingSnapshot(first));
    expect(
      fingerprintBuildingSnapshot(
        createBuildingSnapshot({ revision: 8, instances: first.instances }, WORLD_CONFIG),
      ),
    ).not.toBe(fingerprintBuildingSnapshot(first));
  });
});
