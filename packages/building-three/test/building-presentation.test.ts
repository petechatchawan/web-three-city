import { createBuildingSnapshot, type BuildingInstance } from '@web-three-city/building-core';
import type { WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
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

const INSTANCES: readonly BuildingInstance[] = Object.freeze([
  Object.freeze({
    instanceId: 'cottage',
    buildingDefinitionId: 'residential-cottage-1x1',
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ x: 0, z: 0 }),
    rotationQuarterTurns: 0,
  }),
  Object.freeze({
    instanceId: 'rowhouse',
    buildingDefinitionId: 'residential-rowhouse-1x2',
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ x: 1, z: 0 }),
    rotationQuarterTurns: 0,
  }),
  Object.freeze({
    instanceId: 'shop',
    buildingDefinitionId: 'commercial-shop-1x1',
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ x: 3, z: 0 }),
    rotationQuarterTurns: 1,
  }),
  Object.freeze({
    instanceId: 'office',
    buildingDefinitionId: 'commercial-office-2x2',
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ x: 4, z: 0 }),
    rotationQuarterTurns: 2,
  }),
  Object.freeze({
    instanceId: 'workshop',
    buildingDefinitionId: 'industrial-workshop-1x2',
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ x: 0, z: 3 }),
    rotationQuarterTurns: 0,
  }),
  Object.freeze({
    instanceId: 'warehouse',
    buildingDefinitionId: 'industrial-warehouse-2x2',
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ x: 2, z: 3 }),
    rotationQuarterTurns: 3,
  }),
]);

const ENTRANCE_PART_NAMES = new Set([
  'building-door',
  'building-storefront',
  'building-entrance',
  'building-bay-door',
]);

describe('BuildingPresentation', () => {
  it('derives one named, oriented prototype group per authoritative instance', () => {
    const scene = new THREE.Scene();
    const presentation = new BuildingPresentation(scene, () => 1, CONFIG);
    const snapshot = createBuildingSnapshot({ revision: 1, instances: INSTANCES }, CONFIG);

    presentation.load(snapshot);

    expect(presentation.root.name).toBe('building-committed-root');
    expect(presentation.root.children).toHaveLength(6);
    expect(presentation.root.children.map((child) => child.userData.instanceId)).toEqual([
      'cottage',
      'office',
      'rowhouse',
      'shop',
      'warehouse',
      'workshop',
    ]);
    const shop = presentation.root.children.find((child) => child.userData.instanceId === 'shop');
    const office = presentation.root.children.find((child) => child.userData.instanceId === 'office');
    const warehouse = presentation.root.children.find(
      (child) => child.userData.instanceId === 'warehouse',
    );
    expect(shop?.rotation.y).toBeCloseTo(-Math.PI / 2);
    expect(office?.rotation.y).toBeCloseTo(-Math.PI);
    expect(warehouse?.rotation.y).toBeCloseTo(-(3 * Math.PI) / 2);
    expect(
      presentation.root.children.every((child) =>
        child.children.some((part) => ENTRANCE_PART_NAMES.has(part.name)),
      ),
    ).toBe(true);

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
