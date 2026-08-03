import { describe, expect, it } from 'vitest';
import { createBuildingSnapshot } from '@web-three-city/building-core';
import type { WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import { BuildingPresentation } from '../src/index.js';

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

describe('BuildingPresentation', () => {
  it('derives one named prototype group per authoritative instance', () => {
    const scene = new THREE.Scene();
    const presentation = new BuildingPresentation(scene, () => 1, CONFIG);
    const snapshot = createBuildingSnapshot(
      {
        revision: 1,
        instances: [
          Object.freeze({
            instanceId: 'r',
            buildingDefinitionId: 'residential-cottage-1x1',
            buildingDefinitionVersion: 1,
            originCell: Object.freeze({ x: 1, z: 1 }),
            rotationQuarterTurns: 0,
          }),
          Object.freeze({
            instanceId: 'c',
            buildingDefinitionId: 'commercial-shop-1x1',
            buildingDefinitionVersion: 1,
            originCell: Object.freeze({ x: 3, z: 1 }),
            rotationQuarterTurns: 1,
          }),
          Object.freeze({
            instanceId: 'i',
            buildingDefinitionId: 'industrial-workshop-1x2',
            buildingDefinitionVersion: 1,
            originCell: Object.freeze({ x: 5, z: 1 }),
            rotationQuarterTurns: 0,
          }),
        ],
      },
      CONFIG,
    );
    presentation.load(snapshot);
    expect(presentation.root.name).toBe('building-committed-root');
    expect(presentation.root.children).toHaveLength(3);
    expect(presentation.root.children.map((child) => child.userData.instanceId)).toEqual([
      'r',
      'c',
      'i',
    ]);
    expect(presentation.root.children[1]?.rotation.y).toBeCloseTo(-Math.PI / 2);
    presentation.dispose();
    expect(scene.getObjectByName('building-committed-root')).toBeUndefined();
  });

  it('clears derived geometry without mutating authoritative state', () => {
    const scene = new THREE.Scene();
    const presentation = new BuildingPresentation(scene, () => 0, CONFIG);
    const snapshot = createBuildingSnapshot({ revision: 0, instances: [] }, CONFIG);
    presentation.load(snapshot);
    presentation.clear();
    expect(snapshot.instances).toHaveLength(0);
    expect(presentation.root.children).toHaveLength(0);
  });
});
