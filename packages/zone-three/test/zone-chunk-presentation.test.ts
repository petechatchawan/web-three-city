import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createEmptyZoneSnapshot } from '@web-three-city/zone-core';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  ZoneChunkPresentation,
  type ZoneMeshData,
  type ZonePresentationSource,
} from '../src/index.js';

function triangleData(materialIndex = 0): ZoneMeshData {
  return Object.freeze({
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
    indices: new Uint32Array([0, 2, 1]),
    groups: Object.freeze([{ start: 0, count: 3, materialIndex }]),
    cellCount: 1,
    bounds: Object.freeze({ minX: 0, maxX: 1, minY: 0, maxY: 0, minZ: 0, maxZ: 1 }),
  });
}

describe('ZoneChunkPresentation', () => {
  it('loads one committed root per canonical chunk', () => {
    const scene = new THREE.Scene();
    const source: ZonePresentationSource = {
      buildChunk: () => triangleData(),
    };
    const presentation = new ZoneChunkPresentation(scene, source, WORLD_CONFIG);
    presentation.loadAll(createEmptyZoneSnapshot(WORLD_CONFIG));

    expect(scene.getObjectByName('zone-committed-root')).toBeDefined();
    expect(presentation.chunkCount).toBe(64);
    expect(presentation.getChunkObject({ x: 0, z: 0 }).name).toBe('zone-chunk:0:0');
    presentation.dispose();
    expect(scene.getObjectByName('zone-committed-root')).toBeUndefined();
  });

  it('preserves the previous committed chunk when replacement staging fails', () => {
    const scene = new THREE.Scene();
    let fail = false;
    const source: ZonePresentationSource = {
      buildChunk(_zones, chunk) {
        if (fail && chunk.x === 0 && chunk.z === 0) throw new Error('fixture-failure');
        return triangleData();
      },
    };
    const presentation = new ZoneChunkPresentation(scene, source, WORLD_CONFIG);
    const zones = createEmptyZoneSnapshot(WORLD_CONFIG);
    presentation.loadAll(zones);
    const previous = presentation.getChunkObject({ x: 0, z: 0 });

    fail = true;
    expect(() => presentation.rebuildDirty(zones, [{ x: 0, z: 0 }])).toThrow('fixture-failure');
    expect(presentation.getChunkObject({ x: 0, z: 0 })).toBe(previous);
    expect(previous.parent).not.toBeNull();
  });

  it('swaps atomically and disposes previous geometry after success', () => {
    const scene = new THREE.Scene();
    const source: ZonePresentationSource = {
      buildChunk: () => triangleData(),
    };
    const presentation = new ZoneChunkPresentation(scene, source, WORLD_CONFIG);
    const zones = createEmptyZoneSnapshot(WORLD_CONFIG);
    presentation.loadAll(zones);
    const previous = presentation.getChunkObject({ x: 0, z: 0 });
    const mesh = previous.children[0] as THREE.Mesh;
    const dispose = vi.spyOn(mesh.geometry, 'dispose');

    presentation.rebuildDirty(zones, [{ x: 0, z: 0 }]);
    expect(presentation.getChunkObject({ x: 0, z: 0 })).not.toBe(previous);
    expect(dispose).toHaveBeenCalledOnce();
    expect(previous.parent).toBeNull();
  });
});
