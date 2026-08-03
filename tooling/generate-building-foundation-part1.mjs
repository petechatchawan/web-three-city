#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

async function write(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

await write(
  'packages/building-core/src/index.ts',
  `export * from './contracts.js';
export * from './building-definitions.js';
export * from './building-footprint.js';
export * from './building-frontage.js';
export * from './building-snapshot.js';
export * from './building-mutation.js';
export * from './serialization.js';
`,
);

await write(
  'packages/building-core/test/building-definitions.test.ts',
  `import { describe, expect, it } from 'vitest';
import { buildingDefinitionForId, buildingDefinitions } from '../src/index.js';

describe('building definitions', () => {
  it('provides six immutable versioned definitions with strict zone compatibility', () => {
    const definitions = buildingDefinitions();
    expect(definitions).toHaveLength(6);
    expect(new Set(definitions.map((entry) => entry.id)).size).toBe(6);
    for (const definition of definitions) {
      expect(definition.version).toBe(1);
      expect(definition.compatibleZoneDefinitionIds).toHaveLength(1);
      expect(definition.allowedRotationQuarterTurns).toEqual([0, 1, 2, 3]);
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.compatibleZoneDefinitionIds)).toBe(true);
    }
  });

  it('fails closed for an unknown definition', () => {
    expect(() => buildingDefinitionForId('missing' as never)).toThrow(
      'building-definition:unknown-id',
    );
  });
});
`,
);

await write(
  'packages/building-core/test/building-footprint.test.ts',
  `import { describe, expect, it } from 'vitest';
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
`,
);

await write(
  'packages/building-core/test/building-snapshot.test.ts',
  `import { describe, expect, it } from 'vitest';
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
`,
);

await write(
  'packages/building-core/test/building-frontage.test.ts',
  `import { describe, expect, it } from 'vitest';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import {
  resolveBuildingFrontage,
  type BuildingDevelopmentEnvironment,
  type BuildingInstance,
} from '../src/index.js';

const FLAT = Object.freeze({
  cell: Object.freeze({ x: 0, z: 0 }),
  corners: Object.freeze({ nw: 2, ne: 2, sw: 2, se: 2 }),
  shape: 'flat',
  minimumLevel: 2,
  maximumLevel: 2,
  slopeAxis: null,
}) as TerrainCellSurfaceProfile;
const INSTANCE: BuildingInstance = Object.freeze({
  instanceId: 'building:1:1',
  buildingDefinitionId: 'commercial-office-2x2',
  buildingDefinitionVersion: 1,
  originCell: Object.freeze({ x: 2, z: 2 }),
  rotationQuarterTurns: 0,
});

function environment(): BuildingDevelopmentEnvironment {
  return Object.freeze({
    terrainRevision: 1,
    waterSourceTerrainRevision: 1,
    roadRevision: 1,
    zoneRevision: 1,
    surfaceAt: () => FLAT,
    isDry: () => true,
    isRoadOccupied: () => false,
    zoneDefinitionIdAt: () => 'commercial',
    roadAccessAt(cell) {
      if (cell.x === 2 && cell.z === 2) {
        return Object.freeze({ direction: 'east', distance: 1, roadCell: Object.freeze({ x: 4, z: 2 }) });
      }
      if (cell.x === 3 && cell.z === 2) {
        return Object.freeze({ direction: 'north', distance: 1, roadCell: Object.freeze({ x: 3, z: 1 }) });
      }
      return null;
    },
  });
}

describe('building frontage', () => {
  it('uses distance then north/east/south/west and cell order', () => {
    expect(resolveBuildingFrontage(INSTANCE, environment())).toEqual({
      direction: 'north',
      distance: 1,
      frontageCell: { x: 3, z: 2 },
      roadCell: { x: 3, z: 1 },
    });
  });
});
`,
);

await write(
  'packages/building-core/test/building-mutation.test.ts',
  `import { describe, expect, it } from 'vitest';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';
import {
  BuildingContractError,
  buildingAtCell,
  commitBuildingMutation,
  createEmptyBuildingSnapshot,
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

function environment(overrides: Partial<BuildingDevelopmentEnvironment> = {}): BuildingDevelopmentEnvironment {
  return Object.freeze({
    terrainRevision: 5,
    waterSourceTerrainRevision: 5,
    roadRevision: 2,
    zoneRevision: 7,
    surfaceAt: () => FLAT,
    isDry: () => true,
    isRoadOccupied: () => false,
    zoneDefinitionIdAt(cell) {
      return cell.x >= 1 && cell.x <= 2 && cell.z >= 1 && cell.z <= 2 ? 'commercial' : null;
    },
    roadAccessAt(cell) {
      return cell.z === 1
        ? Object.freeze({ direction: 'north', distance: 1, roadCell: Object.freeze({ x: cell.x, z: 0 }) })
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
      rotationQuarterTurns: 0,
    });
    const committed = commitBuildingMutation(before, plan, environment(), CONFIG);
    expect(committed.snapshot.revision).toBe(1);
    expect(committed.receipt.addedCellCount).toBe(4);
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

  it('fails closed for mixed Zones and stale source revisions', () => {
    const before = createEmptyBuildingSnapshot(CONFIG);
    const mixed = environment({
      zoneDefinitionIdAt(cell) {
        if (cell.x === 1 && cell.z === 1) return 'commercial';
        if (cell.x === 2 && cell.z === 1) return 'residential';
        return null;
      },
    });
    expect(planBuildingDevelopment(before, mixed, CONFIG).valid).toBe(false);

    const plan = planBuildingDevelopment(before, environment(), CONFIG);
    expect(() =>
      commitBuildingMutation(before, plan, environment({ roadRevision: 3 }), CONFIG),
    ).toThrowError(new BuildingContractError('building:stale-road-plan'));
  });
});
`,
);

await write(
  'packages/building-core/test/serialization.test.ts',
  `import { describe, expect, it } from 'vitest';
import type { WorldConfig } from '@web-three-city/world-core';
import {
  createBuildingSnapshot,
  decodeBuildingSaveV1,
  encodeBuildingSaveV1,
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

describe('building serialization', () => {
  it('round-trips only authoritative instance fields', () => {
    const snapshot = createBuildingSnapshot(
      {
        revision: 4,
        instances: [
          Object.freeze({
            instanceId: 'building:4:1',
            buildingDefinitionId: 'industrial-workshop-1x2',
            buildingDefinitionVersion: 1,
            originCell: Object.freeze({ x: 2, z: 3 }),
            rotationQuarterTurns: 1,
          }),
        ],
      },
      CONFIG,
    );
    const encoded = encodeBuildingSaveV1(snapshot);
    expect(encoded.instances[0]).not.toHaveProperty('occupiedCells');
    expect(decodeBuildingSaveV1(encoded, CONFIG)).toEqual({ ok: true, value: snapshot });
  });

  it('rejects unknown content, invalid rotations, and overlapping footprints', () => {
    const base = {
      kind: 'building-save',
      schemaVersion: 1,
      revision: 1,
      instances: [],
    } as const;
    expect(
      decodeBuildingSaveV1(
        {
          ...base,
          instances: [{ instanceId: 'x', buildingDefinitionId: 'missing', buildingDefinitionVersion: 1, originCell: { x: 0, z: 0 }, rotationQuarterTurns: 0 }],
        },
        CONFIG,
      ),
    ).toMatchObject({ ok: false, error: { code: 'building-save:unknown-definition' } });
    expect(
      decodeBuildingSaveV1(
        {
          ...base,
          instances: [{ instanceId: 'x', buildingDefinitionId: 'residential-cottage-1x1', buildingDefinitionVersion: 1, originCell: { x: 0, z: 0 }, rotationQuarterTurns: 9 }],
        },
        CONFIG,
      ),
    ).toMatchObject({ ok: false, error: { code: 'building-save:invalid-rotation' } });
  });
});
`,
);

await write(
  'packages/building-three/package.json',
  `{
  "name": "@web-three-city/building-three",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": "./src/index.ts",
  "dependencies": {
    "@web-three-city/building-core": "workspace:*",
    "@web-three-city/world-core": "workspace:*",
    "three": "0.185.1"
  },
  "scripts": {
    "test": "vitest run --passWithNoTests",
    "test:coverage": "vitest run --coverage --passWithNoTests",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "build": "tsc -p tsconfig.build.json"
  }
}
`,
);
await write(
  'packages/building-three/tsconfig.json',
  `{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src", "test", "vitest.config.ts"]
}
`,
);
await write(
  'packages/building-three/tsconfig.build.json',
  `{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
`,
);
await write(
  'packages/building-three/vitest.config.ts',
  `import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['test/**/*.test.ts'] } });
`,
);

await write(
  'packages/building-three/src/material-factory.ts',
  `import * as THREE from 'three';

export interface BuildingMaterials {
  readonly residential: THREE.MeshLambertMaterial;
  readonly commercial: THREE.MeshLambertMaterial;
  readonly industrial: THREE.MeshLambertMaterial;
  readonly roof: THREE.MeshLambertMaterial;
  readonly accent: THREE.MeshLambertMaterial;
  dispose(): void;
}

export function createBuildingMaterials(): BuildingMaterials {
  const materials = {
    residential: new THREE.MeshLambertMaterial({ color: 0xe9c98f }),
    commercial: new THREE.MeshLambertMaterial({ color: 0x8db6d9 }),
    industrial: new THREE.MeshLambertMaterial({ color: 0xb2a58c }),
    roof: new THREE.MeshLambertMaterial({ color: 0x9e5f4b }),
    accent: new THREE.MeshLambertMaterial({ color: 0x40566b }),
  };
  return Object.freeze({
    ...materials,
    dispose(): void {
      for (const material of Object.values(materials)) material.dispose();
    },
  });
}
`,
);

await write(
  'packages/building-three/src/prototype-factory.ts',
  `import { buildingDefinitionForId, type BuildingInstance } from '@web-three-city/building-core';
import type { WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import type { BuildingMaterials } from './material-factory.js';

function addBox(
  group: THREE.Group,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  material: THREE.Material,
  name: string,
): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  group.add(mesh);
}

export function createBuildingPrototype(
  instance: BuildingInstance,
  materials: BuildingMaterials,
  config: WorldConfig,
): THREE.Group {
  const definition = buildingDefinitionForId(instance.buildingDefinitionId);
  const group = new THREE.Group();
  group.name = 'building-instance';
  group.userData.instanceId = instance.instanceId;
  group.userData.definitionId = definition.id;
  const bodyMaterial = definition.compatibleZoneDefinitionIds[0] === 'residential'
    ? materials.residential
    : definition.compatibleZoneDefinitionIds[0] === 'commercial'
      ? materials.commercial
      : materials.industrial;
  const h = definition.prototypeHeight;

  switch (definition.prototypeId) {
    case 'cottage':
      addBox(group, [0.72, h * 0.7, 0.72], [0, h * 0.35, 0], bodyMaterial, 'building-body');
      addBox(group, [0.82, h * 0.18, 0.82], [0, h * 0.79, 0], materials.roof, 'building-roof');
      addBox(group, [0.16, 0.28, 0.05], [0, 0.2, 0.385], materials.accent, 'building-door');
      break;
    case 'rowhouse':
      addBox(group, [0.76, h * 0.82, 1.7], [0, h * 0.41, 0], bodyMaterial, 'building-body');
      addBox(group, [0.84, h * 0.12, 1.78], [0, h * 0.88, 0], materials.roof, 'building-roof');
      break;
    case 'shop':
      addBox(group, [0.82, h * 0.7, 0.82], [0, h * 0.35, 0], bodyMaterial, 'building-body');
      addBox(group, [0.72, 0.18, 0.05], [0, 0.34, 0.435], materials.accent, 'building-storefront');
      break;
    case 'office':
      addBox(group, [1.65, h, 1.65], [0, h * 0.5, 0], bodyMaterial, 'building-body');
      for (const y of [0.45, 0.95, 1.45]) addBox(group, [1.72, 0.06, 1.72], [0, y, 0], materials.accent, 'building-floor-band');
      break;
    case 'workshop':
      addBox(group, [0.82, h * 0.75, 1.68], [0, h * 0.375, 0], bodyMaterial, 'building-body');
      addBox(group, [0.55, 0.42, 0.05], [0, 0.3, 0.865], materials.accent, 'building-bay-door');
      break;
    case 'warehouse':
      addBox(group, [1.72, h * 0.72, 1.72], [0, h * 0.36, 0], bodyMaterial, 'building-body');
      addBox(group, [1.82, h * 0.12, 1.82], [0, h * 0.78, 0], materials.roof, 'building-roof');
      addBox(group, [0.75, 0.48, 0.05], [0, 0.32, 0.885], materials.accent, 'building-bay-door');
      break;
  }
  group.scale.setScalar(config.cellSize);
  return group;
}
`,
);

await write(
  'packages/building-three/src/building-presentation.ts',
  `import {
  buildingDefinitionForId,
  occupiedCellsForBuilding,
  rotatedBuildingFootprint,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import { createBuildingMaterials, type BuildingMaterials } from './material-factory.js';
import { createBuildingPrototype } from './prototype-factory.js';

export type BuildingElevationResolver = (cell: CellCoord) => number;

export class BuildingPresentation {
  readonly #scene: THREE.Scene;
  readonly #config: WorldConfig;
  readonly #elevationAt: BuildingElevationResolver;
  readonly #materials: BuildingMaterials;
  readonly #root = new THREE.Group();
  #disposed = false;

  constructor(scene: THREE.Scene, elevationAt: BuildingElevationResolver, config: WorldConfig) {
    this.#scene = scene;
    this.#elevationAt = elevationAt;
    this.#config = config;
    this.#materials = createBuildingMaterials();
    this.#root.name = 'building-committed-root';
    scene.add(this.#root);
  }

  get root(): THREE.Group {
    return this.#root;
  }

  clear(): void {
    for (const child of [...this.#root.children]) {
      child.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      this.#root.remove(child);
    }
  }

  load(snapshot: BuildingSnapshot): void {
    if (this.#disposed) throw new Error('building-presentation:disposed');
    this.clear();
    for (const instance of snapshot.instances) {
      const definition = buildingDefinitionForId(instance.buildingDefinitionId);
      const footprint = rotatedBuildingFootprint(definition, instance.rotationQuarterTurns);
      const occupied = occupiedCellsForBuilding(instance);
      const elevation = Math.max(...occupied.map((cell) => this.#elevationAt(cell)));
      const group = createBuildingPrototype(instance, this.#materials, this.#config);
      group.position.set(
        (instance.originCell.x + footprint.width / 2) * this.#config.cellSize -
          (this.#config.mapWidth * this.#config.cellSize) / 2,
        elevation,
        (instance.originCell.z + footprint.depth / 2) * this.#config.cellSize -
          (this.#config.mapHeight * this.#config.cellSize) / 2,
      );
      group.rotation.y = -instance.rotationQuarterTurns * (Math.PI / 2);
      this.#root.add(group);
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.clear();
    this.#materials.dispose();
    this.#scene.remove(this.#root);
  }
}
`,
);
await write(
  'packages/building-three/src/index.ts',
  `export * from './material-factory.js';
export * from './prototype-factory.js';
export * from './building-presentation.js';
`,
);

await write(
  'packages/building-three/test/building-presentation.test.ts',
  `import { describe, expect, it } from 'vitest';
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
          Object.freeze({ instanceId: 'r', buildingDefinitionId: 'residential-cottage-1x1', buildingDefinitionVersion: 1, originCell: Object.freeze({ x: 1, z: 1 }), rotationQuarterTurns: 0 }),
          Object.freeze({ instanceId: 'c', buildingDefinitionId: 'commercial-shop-1x1', buildingDefinitionVersion: 1, originCell: Object.freeze({ x: 3, z: 1 }), rotationQuarterTurns: 1 }),
          Object.freeze({ instanceId: 'i', buildingDefinitionId: 'industrial-workshop-1x2', buildingDefinitionVersion: 1, originCell: Object.freeze({ x: 5, z: 1 }), rotationQuarterTurns: 0 }),
        ],
      },
      CONFIG,
    );
    presentation.load(snapshot);
    expect(presentation.root.name).toBe('building-committed-root');
    expect(presentation.root.children).toHaveLength(3);
    expect(presentation.root.children.map((child) => child.userData.instanceId)).toEqual(['r', 'c', 'i']);
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
`,
);

await write(
  'apps/game/src/building-world-occupancy.ts',
  `import { buildingOccupiedAt, type BuildingSnapshot } from '@web-three-city/building-core';
import type { ZoneWorldOccupancy } from './zone-placement-environment.js';

export function createBuildingWorldOccupancy(buildings: BuildingSnapshot): ZoneWorldOccupancy {
  return Object.freeze({
    revision: buildings.revision,
    isBlocked: (cell) => buildingOccupiedAt(buildings, cell),
  });
}
`,
);

await write(
  'apps/game/src/building-development-environment.ts',
  `import type { BuildingDevelopmentEnvironment } from '@web-three-city/building-core';
import { roadOccupiedAt, type RoadSnapshot } from '@web-three-city/road-core';
import { terrainCellSurfaceProfile, type TerrainSnapshot } from '@web-three-city/terrain-core';
import { triangleIndexFor, type WaterSnapshot } from '@web-three-city/water-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import {
  findZoneRoadAccess,
  zoneDefinitionCodeAt,
  zoneDefinitionForCode,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';

function validCell(cell: CellCoord, config: WorldConfig): boolean {
  return Number.isInteger(cell.x) && Number.isInteger(cell.z) && cell.x >= 0 && cell.z >= 0 && cell.x < config.mapWidth && cell.z < config.mapHeight;
}

export function createBuildingDevelopmentEnvironment(
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  roads: RoadSnapshot,
  zones: ZoneSnapshot,
  config: WorldConfig,
): BuildingDevelopmentEnvironment {
  if (terrain.width !== config.mapWidth || terrain.height !== config.mapHeight || roads.width !== config.mapWidth || roads.height !== config.mapHeight || zones.width !== config.mapWidth || zones.height !== config.mapHeight || water.width !== config.mapWidth || water.height !== config.mapHeight) {
    throw new RangeError('building-environment:invalid-dimensions');
  }
  if (water.sourceTerrainRevision !== terrain.revision) throw new RangeError('building-environment:incoherent-revision');
  const seaMask = water.seaTriangleMask.slice();
  const environment: BuildingDevelopmentEnvironment = Object.freeze({
    terrainRevision: terrain.revision,
    waterSourceTerrainRevision: water.sourceTerrainRevision,
    roadRevision: roads.revision,
    zoneRevision: zones.revision,
    surfaceAt(cell) {
      if (!validCell(cell, config)) throw new RangeError('building-environment:invalid-cell');
      return terrainCellSurfaceProfile(terrain, cell, config);
    },
    isDry(cell) {
      if (!validCell(cell, config)) return false;
      const first = triangleIndexFor(cell.x, cell.z, 0, config.mapWidth);
      const second = triangleIndexFor(cell.x, cell.z, 1, config.mapWidth);
      return seaMask[first] === 0 && seaMask[second] === 0;
    },
    isRoadOccupied(cell) {
      return validCell(cell, config) && roadOccupiedAt(roads, cell);
    },
    zoneDefinitionIdAt(cell) {
      if (!validCell(cell, config)) return null;
      return zoneDefinitionForCode(zoneDefinitionCodeAt(zones, cell))?.id ?? null;
    },
    roadAccessAt(cell) {
      return findZoneRoadAccess(
        cell,
        {
          surfaceAt: environment.surfaceAt,
          isDry: environment.isDry,
          isRoadOccupied: environment.isRoadOccupied,
          isBlockedByNonZoneOccupancy: () => false,
        },
        config,
      );
    },
  });
  return environment;
}
`,
);

await write(
  'apps/game/src/road-building-guard.ts',
  `import {
  buildingOccupiedAt,
  resolveBuildingFrontage,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import { createRoadSnapshot, type RoadSnapshot } from '@web-three-city/road-core';
import type { TerrainSnapshot } from '@web-three-city/terrain-core';
import type { WaterSnapshot } from '@web-three-city/water-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import type { ZoneSnapshot } from '@web-three-city/zone-core';
import { createBuildingDevelopmentEnvironment } from './building-development-environment.js';
import type { GuardedRoadCandidate, GameRoadInvalidReason } from './road-zone-guard.js';

export type GameRoadBuildingInvalidReason = GameRoadInvalidReason | 'road:building-occupied' | 'road:building-access-lost';

export interface GuardedRoadBuildingCandidate extends Omit<GuardedRoadCandidate, 'invalidReason'> {
  readonly invalidReason: GameRoadBuildingInvalidReason | null;
  readonly blockedBuildingCells: readonly CellCoord[];
}

function sorted(cells: Iterable<CellCoord>): readonly CellCoord[] {
  const unique = new Map<string, CellCoord>();
  for (const cell of cells) unique.set(`${cell.x}:${cell.z}`, cell);
  return Object.freeze([...unique.values()].map((cell) => Object.freeze({ ...cell })).sort((a, b) => a.z - b.z || a.x - b.x));
}

export function guardRoadPlanWithBuildings(
  candidate: GuardedRoadCandidate,
  baseRoads: RoadSnapshot,
  buildings: BuildingSnapshot,
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  zones: ZoneSnapshot,
  config: WorldConfig,
): GuardedRoadBuildingCandidate {
  if (!candidate.valid) return Object.freeze({ ...candidate, blockedBuildingCells: Object.freeze([]) });
  const overlaps = sorted(candidate.corePlan.addedCells.filter((cell) => buildingOccupiedAt(buildings, cell)));
  if (overlaps.length > 0) return Object.freeze({ ...candidate, valid: false, previewPlan: Object.freeze({ ...candidate.previewPlan, valid: false }), invalidReason: 'road:building-occupied', blockedBuildingCells: overlaps });

  if (candidate.corePlan.operation === 'bulldoze' && buildings.instances.length > 0) {
    const proposedRoads = createRoadSnapshot({ width: baseRoads.width, height: baseRoads.height, revision: baseRoads.revision + 1, definitionCodes: candidate.corePlan.proposedDefinitionCodes }, config);
    const before = createBuildingDevelopmentEnvironment(terrain, water, baseRoads, zones, config);
    const after = createBuildingDevelopmentEnvironment(terrain, water, proposedRoads, zones, config);
    const lost: CellCoord[] = [];
    for (const instance of buildings.instances) {
      if (resolveBuildingFrontage(instance, before) !== null && resolveBuildingFrontage(instance, after) === null) lost.push(instance.originCell);
    }
    const blocked = sorted(lost);
    if (blocked.length > 0) return Object.freeze({ ...candidate, valid: false, previewPlan: Object.freeze({ ...candidate.previewPlan, valid: false }), invalidReason: 'road:building-access-lost', blockedBuildingCells: blocked });
  }
  return Object.freeze({ ...candidate, blockedBuildingCells: Object.freeze([]) });
}
`,
);

await write(
  'apps/game/src/zone-building-guard.ts',
  `import { buildingOccupiedAt, type BuildingSnapshot } from '@web-three-city/building-core';
import type { CellCoord } from '@web-three-city/world-core';
import type { ZoneInvalidReason, ZoneMutationPlan } from '@web-three-city/zone-core';

export type GameZoneInvalidReason = ZoneInvalidReason | 'zone:building-occupied';

export interface GuardedZoneCandidate {
  readonly corePlan: ZoneMutationPlan;
  readonly previewPlan: ZoneMutationPlan;
  readonly valid: boolean;
  readonly invalidReason: GameZoneInvalidReason | null;
  readonly blockedBuildingCells: readonly CellCoord[];
}

export function guardZonePlanWithBuildings(plan: ZoneMutationPlan, buildings: BuildingSnapshot): GuardedZoneCandidate {
  if (!plan.valid) return Object.freeze({ corePlan: plan, previewPlan: plan, valid: false, invalidReason: plan.invalidReason, blockedBuildingCells: Object.freeze([]) });
  const blocked = Object.freeze(plan.changedCells.filter((cell) => buildingOccupiedAt(buildings, cell)).map((cell) => Object.freeze({ ...cell })));
  if (blocked.length > 0) return Object.freeze({ corePlan: plan, previewPlan: Object.freeze({ ...plan, valid: false }), valid: false, invalidReason: 'zone:building-occupied', blockedBuildingCells: blocked });
  return Object.freeze({ corePlan: plan, previewPlan: plan, valid: true, invalidReason: null, blockedBuildingCells: Object.freeze([]) });
}
`,
);

await write(
  'apps/game/src/building-tool-controller.ts',
  `import type { CellCoord } from '@web-three-city/world-core';
import type { BuildingToolMode } from './game-tool-mode.js';

export interface BuildingToolRequest {
  readonly mode: BuildingToolMode;
  readonly cell: CellCoord;
}
export interface BuildingInputState {
  readonly mode: BuildingToolMode | null;
  readonly strokeActive: boolean;
  readonly cell: CellCoord | null;
}
export interface BuildingToolController {
  begin(pointerId: number, cell: CellCoord): boolean;
  move(pointerId: number, cell: CellCoord): void;
  end(pointerId: number, cell: CellCoord | null): BuildingToolRequest | null;
  cancel(pointerId: number): void;
  cancelAll(): void;
  getState(): BuildingInputState;
}

export function createBuildingToolController(getMode: () => BuildingToolMode | null): BuildingToolController {
  let activePointer: number | null = null;
  let activeCell: CellCoord | null = null;
  const state = (): BuildingInputState => Object.freeze({ mode: getMode(), strokeActive: activePointer !== null, cell: activeCell === null ? null : Object.freeze({ ...activeCell }) });
  return {
    begin(pointerId, cell) {
      if (getMode() === null || activePointer !== null) return false;
      activePointer = pointerId;
      activeCell = Object.freeze({ ...cell });
      return true;
    },
    move(pointerId, cell) {
      if (activePointer === pointerId) activeCell = Object.freeze({ ...cell });
    },
    end(pointerId, cell) {
      if (activePointer !== pointerId) return null;
      const mode = getMode();
      const selected = cell ?? activeCell;
      activePointer = null;
      activeCell = null;
      return mode === null || selected === null ? null : Object.freeze({ mode, cell: Object.freeze({ ...selected }) });
    },
    cancel(pointerId) { if (activePointer === pointerId) { activePointer = null; activeCell = null; } },
    cancelAll() { activePointer = null; activeCell = null; },
    getState: state,
  };
}
`,
);

await write(
  'apps/game/src/building-tool-controller.test.ts',
  `import { describe, expect, it } from 'vitest';
import { createBuildingToolController } from './building-tool-controller.js';

describe('building tool controller', () => {
  it('emits one immutable request on pointer release', () => {
    const controller = createBuildingToolController(() => 'building-bulldoze');
    expect(controller.begin(7, { x: 2, z: 3 })).toBe(true);
    controller.move(7, { x: 3, z: 3 });
    expect(controller.end(7, null)).toEqual({ mode: 'building-bulldoze', cell: { x: 3, z: 3 } });
    expect(controller.getState().strokeActive).toBe(false);
  });
});
`,
);

await write(
  'apps/game/src/building-development-environment.test.ts',
  `import { describe, expect, it } from 'vitest';
import { createEmptyRoadSnapshot } from '@web-three-city/road-core';
import { createEmptyZoneSnapshot } from '@web-three-city/zone-core';
import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createBuildingDevelopmentEnvironment } from './building-development-environment.js';

describe('building development environment', () => {
  it('captures coherent source revisions and fail-closed accessors', () => {
    const generated = generateCoastalTerrain({ seed: 1_464_156_977, config: WORLD_CONFIG });
    if (!generated.ok) throw new Error(generated.error.code);
    const water = deriveWaterSnapshot(generated.value, WORLD_CONFIG);
    if (!water.ok) throw new Error(water.error.code);
    const environment = createBuildingDevelopmentEnvironment(generated.value, water.value, createEmptyRoadSnapshot(WORLD_CONFIG), createEmptyZoneSnapshot(WORLD_CONFIG), WORLD_CONFIG);
    expect(environment.terrainRevision).toBe(generated.value.revision);
    expect(environment.waterSourceTerrainRevision).toBe(generated.value.revision);
    expect(environment.zoneDefinitionIdAt({ x: 0, z: 0 })).toBeNull();
  });
});
`,
);

await write(
  'apps/game/src/zone-building-guard.test.ts',
  `import { describe, expect, it } from 'vitest';
import { createBuildingSnapshot } from '@web-three-city/building-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { guardZonePlanWithBuildings } from './zone-building-guard.js';

describe('zone building guard', () => {
  it('rejects removal beneath an existing building', () => {
    const buildings = createBuildingSnapshot({ revision: 1, instances: [{ instanceId: 'b', buildingDefinitionId: 'residential-cottage-1x1', buildingDefinitionVersion: 1, originCell: { x: 2, z: 2 }, rotationQuarterTurns: 0 }] }, WORLD_CONFIG);
    const plan = { valid: true, invalidReason: null, changedCells: [{ x: 2, z: 2 }] } as unknown as Parameters<typeof guardZonePlanWithBuildings>[0];
    expect(guardZonePlanWithBuildings(plan, buildings)).toMatchObject({ valid: false, invalidReason: 'zone:building-occupied' });
  });
});
`,
);

await write(
  'apps/game/src/road-building-guard.test.ts',
  `import { describe, expect, it } from 'vitest';
import { createBuildingSnapshot } from '@web-three-city/building-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { guardRoadPlanWithBuildings } from './road-building-guard.js';

describe('road building guard', () => {
  it('rejects Road placement over Building occupancy before core commit', () => {
    const buildings = createBuildingSnapshot({ revision: 1, instances: [{ instanceId: 'b', buildingDefinitionId: 'residential-cottage-1x1', buildingDefinitionVersion: 1, originCell: { x: 2, z: 2 }, rotationQuarterTurns: 0 }] }, WORLD_CONFIG);
    const candidate = { valid: true, invalidReason: null, corePlan: { operation: 'build', addedCells: [{ x: 2, z: 2 }] }, previewPlan: { valid: true }, blockedZoneCells: [] } as unknown as Parameters<typeof guardRoadPlanWithBuildings>[0];
    const result = guardRoadPlanWithBuildings(candidate, {} as never, buildings, {} as never, {} as never, {} as never, WORLD_CONFIG);
    expect(result).toMatchObject({ valid: false, invalidReason: 'road:building-occupied' });
  });
});
`,
);

console.log('Generated Building Foundation part 1');
