#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

async function write(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}
async function replaceOnce(path, search, replacement) {
  const source = await readFile(path, 'utf8');
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`authoring:missing-pattern:${path}:${search.slice(0, 100)}`);
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`authoring:ambiguous-pattern:${path}:${search.slice(0, 100)}`);
  await writeFile(path, source.slice(0, index) + replacement + source.slice(index + search.length), 'utf8');
}

await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "import { OrthographicCameraRig } from '@web-three-city/camera-input';\n",
  `import {
  buildingCount,
  commitBuildingMutation,
  createEmptyBuildingSnapshot,
  occupiedBuildingCellCount,
  planBuildingBulldoze,
  planBuildingDevelopment,
  type BuildingDevelopmentEnvironment,
  type BuildingMutationPlan,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import { BuildingPresentation } from '@web-three-city/building-three';
import { OrthographicCameraRig } from '@web-three-city/camera-input';
`,
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "import { createGameInput, type GameRenderViewport } from './game-input.js';\nimport type { GameToolMode } from './game-tool-mode.js';\n",
  "import { createBuildingDevelopmentEnvironment } from './building-development-environment.js';\nimport { createBuildingWorldOccupancy } from './building-world-occupancy.js';\nimport { createGameInput, type GameRenderViewport } from './game-input.js';\nimport type { BuildingToolMode, GameToolMode } from './game-tool-mode.js';\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "import { guardRoadPlanWithZones, type GameRoadInvalidReason } from './road-zone-guard.js';\n",
  "import { guardRoadPlanWithBuildings, type GameRoadBuildingInvalidReason } from './road-building-guard.js';\nimport { guardRoadPlanWithZones } from './road-zone-guard.js';\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "import { decodeWorldSave, encodeWorldSaveV2, type DecodedWorldState } from './world-save.js';\n",
  "import { decodeWorldSave, encodeWorldSaveV3, type DecodedWorldState } from './world-save.js';\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "import { WorldUndoStore, type WorldUndoEntry } from './world-undo.js';\n",
  "import { guardZonePlanWithBuildings, type GameZoneInvalidReason } from './zone-building-guard.js';\nimport { WorldUndoStore, type WorldUndoEntry } from './world-undo.js';\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "const WORLD_SAVE_KEY = 'web-three-city:world-save:v2';\nconst LEGACY_WORLD_SAVE_KEY = 'web-three-city:world-save:v1';\n",
  "const WORLD_SAVE_KEY = 'web-three-city:world-save:v3';\nconst LEGACY_WORLD_SAVE_V2_KEY = 'web-three-city:world-save:v2';\nconst LEGACY_WORLD_SAVE_KEY = 'web-three-city:world-save:v1';\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "  readonly zones: ZoneSnapshot;\n  readonly zoneEnvironment: ZonePlacementEnvironment;\n",
  "  readonly zones: ZoneSnapshot;\n  readonly zoneEnvironment: ZonePlacementEnvironment;\n  readonly buildings: BuildingSnapshot;\n  readonly buildingEnvironment: BuildingDevelopmentEnvironment;\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  `const EMPTY_WORLD_OCCUPANCY: ZoneWorldOccupancy = Object.freeze({
  revision: 0,
  isBlocked: () => false,
});

function stageTerrainWorld(
  terrain: TerrainSnapshot,
  roads: RoadSnapshot,
  zones: ZoneSnapshot,
): RuntimeWorldState {
  const water = requireWater(terrain);
  return Object.freeze({
    terrain,
    water,
    roads,
    roadEnvironment: createRoadPlacementEnvironment(terrain, water, WORLD_CONFIG),
    zones,
    zoneEnvironment: createZonePlacementEnvironment(
      terrain,
      water,
      roads,
      EMPTY_WORLD_OCCUPANCY,
      WORLD_CONFIG,
    ),
  });
}
`,
  `const EMPTY_WORLD_OCCUPANCY: ZoneWorldOccupancy = Object.freeze({ revision: 0, isBlocked: () => false });

function stageTerrainWorld(
  terrain: TerrainSnapshot,
  roads: RoadSnapshot,
  zones: ZoneSnapshot,
  buildings: BuildingSnapshot,
): RuntimeWorldState {
  const water = requireWater(terrain);
  const occupancy = createBuildingWorldOccupancy(buildings);
  return Object.freeze({
    terrain,
    water,
    roads,
    roadEnvironment: createRoadPlacementEnvironment(terrain, water, WORLD_CONFIG),
    zones,
    zoneEnvironment: createZonePlacementEnvironment(terrain, water, roads, occupancy, WORLD_CONFIG),
    buildings,
    buildingEnvironment: createBuildingDevelopmentEnvironment(terrain, water, roads, zones, WORLD_CONFIG),
  });
}
`,
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "function statusForRoadPlan(\n  plan: RoadMutationPlan,\n  reason: GameRoadInvalidReason | null = plan.invalidReason,\n): string {",
  "function statusForRoadPlan(\n  plan: RoadMutationPlan,\n  reason: GameRoadBuildingInvalidReason | null = plan.invalidReason,\n): string {",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "  if (reason === 'road:zone-access-lost') return 'Road required by zone';\n",
  "  if (reason === 'road:zone-access-lost') return 'Road required by zone';\n  if (reason === 'road:building-occupied') return 'Road blocked by building';\n  if (reason === 'road:building-access-lost') return 'Road required by building';\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "function statusForZonePlan(plan: ZoneMutationPlan): string {",
  "function statusForZonePlan(plan: ZoneMutationPlan, routedReason: GameZoneInvalidReason | null = plan.invalidReason): string {",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "  if (plan.valid) return plan.operation === 'paint' ? 'Zone painted' : 'Zone removed';\n",
  "  if (plan.valid && routedReason === null) return plan.operation === 'paint' ? 'Zone painted' : 'Zone removed';\n  if (routedReason === 'zone:building-occupied') return 'Zone blocked by building';\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "  return 'Zone rejected';\n}\n\nexport function bootstrapGame",
  `  return 'Zone rejected';
}

function statusForBuildingPlan(plan: BuildingMutationPlan): string {
  if (plan.valid) return plan.operation === 'develop' ? 'Zones developed' : 'Building bulldozed';
  if (plan.invalidReason === 'building:no-zoned-lot') return 'No eligible Zoned lots';
  if (plan.invalidReason === 'building:not-found') return 'No building selected';
  if (plan.invalidReason === 'building:road-access-required') return 'Building needs Road frontage';
  if (plan.invalidReason === 'building:mixed-zone') return 'Building lot spans mixed Zones';
  if (plan.invalidReason === 'building:wet-cell') return 'Building blocked by water';
  if (plan.invalidReason === 'building:unsupported-terrain') return 'Building requires flat terrain';
  return 'Building rejected';
}

export function bootstrapGame`,
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "  let zonesSnapshot = createEmptyZoneSnapshot(WORLD_CONFIG);\n",
  "  let zonesSnapshot = createEmptyZoneSnapshot(WORLD_CONFIG);\n  let buildingsSnapshot = createEmptyBuildingSnapshot(WORLD_CONFIG);\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  `  let zoneEnvironment = createZonePlacementEnvironment(
    snapshot,
    waterSnapshot,
    roadsSnapshot,
    EMPTY_WORLD_OCCUPANCY,
    WORLD_CONFIG,
  );
`,
  `  let zoneEnvironment = createZonePlacementEnvironment(
    snapshot,
    waterSnapshot,
    roadsSnapshot,
    createBuildingWorldOccupancy(buildingsSnapshot),
    WORLD_CONFIG,
  );
  let buildingEnvironment = createBuildingDevelopmentEnvironment(
    snapshot,
    waterSnapshot,
    roadsSnapshot,
    zonesSnapshot,
    WORLD_CONFIG,
  );
`,
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "  let zoneInvalidReason: ZoneMutationPlan['invalidReason'] = null;\n",
  "  let zoneInvalidReason: GameZoneInvalidReason | null = null;\n  let buildingCommitCount = 0;\n  let buildingBulldozeCount = 0;\n  let buildingUndoCount = 0;\n  let buildingInvalidReason: BuildingMutationPlan['invalidReason'] = null;\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  `  const zonePreview = new ZonePreviewPresentation(
    scene,
    (cell) => terrainCellSurfaceProfile(zoneSurfaceSnapshot, cell, WORLD_CONFIG),
    WORLD_CONFIG,
  );
`,
  `  const zonePreview = new ZonePreviewPresentation(
    scene,
    (cell) => terrainCellSurfaceProfile(zoneSurfaceSnapshot, cell, WORLD_CONFIG),
    WORLD_CONFIG,
  );
  const buildingPresentation = new BuildingPresentation(
    scene,
    (cell) => terrainCellSurfaceProfile(zoneSurfaceSnapshot, cell, WORLD_CONFIG).minimumLevel * WORLD_CONFIG.heightStep,
    WORLD_CONFIG,
  );
`,
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "  zonePresentation.loadAll(zonesSnapshot);\n",
  "  zonePresentation.loadAll(zonesSnapshot);\n  buildingPresentation.load(buildingsSnapshot);\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  `      zones: zonesSnapshot,
      zoneEnvironment,
    };
`,
  `      zones: zonesSnapshot,
      zoneEnvironment,
      buildings: buildingsSnapshot,
      buildingEnvironment,
    };
`,
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "      zonePresentation.loadAll(nextWorld.zones);\n",
  "      zonePresentation.loadAll(nextWorld.zones);\n      buildingPresentation.load(nextWorld.buildings);\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "      zoneEnvironment = nextWorld.zoneEnvironment;\n      ui.setZoneCounts(zoneCounts(zonesSnapshot));\n",
  "      zoneEnvironment = nextWorld.zoneEnvironment;\n      buildingsSnapshot = nextWorld.buildings;\n      buildingEnvironment = nextWorld.buildingEnvironment;\n      ui.setZoneCounts(zoneCounts(zonesSnapshot));\n      ui.setBuildingCount(buildingCount(buildingsSnapshot));\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "        zonePresentation.loadAll(previousWorld.zones);\n",
  "        zonePresentation.loadAll(previousWorld.zones);\n        buildingPresentation.load(previousWorld.buildings);\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "      nextWorld = stageTerrainWorld(nextSnapshot, roadsSnapshot, zonesSnapshot);\n",
  "      nextWorld = stageTerrainWorld(nextSnapshot, roadsSnapshot, zonesSnapshot, buildingsSnapshot);\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "    const candidate = guardTerraformPlanWithOccupancy(plan, roadsSnapshot, zonesSnapshot);\n",
  "    const candidate = guardTerraformPlanWithOccupancy(plan, roadsSnapshot, zonesSnapshot, buildingsSnapshot);\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "        candidate.invalidReason === 'terraform:zone-occupied'\n          ? 'Terraform blocked by zone'\n          : candidate.invalidReason === 'terraform:road-occupied'\n",
  "        candidate.invalidReason === 'terraform:building-occupied'\n          ? 'Terraform blocked by building'\n          : candidate.invalidReason === 'terraform:zone-occupied'\n            ? 'Terraform blocked by zone'\n            : candidate.invalidReason === 'terraform:road-occupied'\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "    routedReason: GameRoadInvalidReason | null = null,\n",
  "    routedReason: GameRoadBuildingInvalidReason | null = null,\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  `    const candidate = guardRoadPlanWithZones(
      plan,
      roadsSnapshot,
      zonesSnapshot,
      snapshot,
      waterSnapshot,
      EMPTY_WORLD_OCCUPANCY,
      WORLD_CONFIG,
    );
`,
  `    const zoneCandidate = guardRoadPlanWithZones(
      plan,
      roadsSnapshot,
      zonesSnapshot,
      snapshot,
      waterSnapshot,
      createBuildingWorldOccupancy(buildingsSnapshot),
      WORLD_CONFIG,
    );
    const candidate = guardRoadPlanWithBuildings(
      zoneCandidate,
      roadsSnapshot,
      buildingsSnapshot,
      snapshot,
      waterSnapshot,
      zonesSnapshot,
      WORLD_CONFIG,
    );
`,
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  `      zoneEnvironment = createZonePlacementEnvironment(
        snapshot,
        waterSnapshot,
        roadsSnapshot,
        EMPTY_WORLD_OCCUPANCY,
        WORLD_CONFIG,
      );
`,
  `      zoneEnvironment = createZonePlacementEnvironment(
        snapshot,
        waterSnapshot,
        roadsSnapshot,
        createBuildingWorldOccupancy(buildingsSnapshot),
        WORLD_CONFIG,
      );
      buildingEnvironment = createBuildingDevelopmentEnvironment(snapshot, waterSnapshot, roadsSnapshot, zonesSnapshot, WORLD_CONFIG);
`,
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "  const applyZonePlan = (plan: ZoneMutationPlan): void => {\n    zoneInvalidReason = plan.invalidReason;\n    if (!plan.valid) {\n      ui.setStatus(statusForZonePlan(plan));\n",
  "  const applyZonePlan = (plan: ZoneMutationPlan, routedReason: GameZoneInvalidReason | null = plan.invalidReason): void => {\n    zoneInvalidReason = routedReason;\n    const candidate = guardZonePlanWithBuildings(plan, buildingsSnapshot);\n    const reason = routedReason ?? candidate.invalidReason;\n    if (!candidate.valid || reason !== null) {\n      ui.setStatus(statusForZonePlan(candidate.previewPlan, reason));\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "      const committed = commitZoneMutation(zonesSnapshot, plan, zoneEnvironment, WORLD_CONFIG);\n",
  "      const committed = commitZoneMutation(zonesSnapshot, candidate.corePlan, zoneEnvironment, WORLD_CONFIG);\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "      zonesSnapshot = committed.snapshot;\n      undoStore.replace({ kind: 'zone', zones: before });\n",
  "      zonesSnapshot = committed.snapshot;\n      buildingEnvironment = createBuildingDevelopmentEnvironment(snapshot, waterSnapshot, roadsSnapshot, zonesSnapshot, WORLD_CONFIG);\n      undoStore.replace({ kind: 'zone', zones: before });\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "      if (plan.operation === 'paint') zoneCommitCount += 1;\n",
  "      if (candidate.corePlan.operation === 'paint') zoneCommitCount += 1;\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "      ui.setStatus(statusForZonePlan(plan));\n",
  "      ui.setStatus(statusForZonePlan(candidate.corePlan));\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "  const resetCamera = (): void => {\n",
  `  const applyBuildingRequest = (mode: BuildingToolMode, cell: CellCoord): void => {
    const plan = mode === 'building-develop'
      ? planBuildingDevelopment(buildingsSnapshot, buildingEnvironment, WORLD_CONFIG)
      : planBuildingBulldoze(buildingsSnapshot, cell, buildingEnvironment, WORLD_CONFIG);
    buildingInvalidReason = plan.invalidReason;
    if (!plan.valid) {
      ui.setStatus(statusForBuildingPlan(plan));
      ui.setUndoAvailable(undoStore.available);
      return;
    }
    const before = buildingsSnapshot;
    try {
      const committed = commitBuildingMutation(buildingsSnapshot, plan, buildingEnvironment, WORLD_CONFIG);
      buildingsSnapshot = committed.snapshot;
      buildingPresentation.load(buildingsSnapshot);
      zoneEnvironment = createZonePlacementEnvironment(snapshot, waterSnapshot, roadsSnapshot, createBuildingWorldOccupancy(buildingsSnapshot), WORLD_CONFIG);
      undoStore.replace({ kind: 'building', buildings: before });
      if (plan.operation === 'develop') buildingCommitCount += 1;
      else buildingBulldozeCount += 1;
      buildingInvalidReason = null;
      ui.setBuildingCount(buildingCount(buildingsSnapshot));
      ui.setStatus(statusForBuildingPlan(plan));
    } catch {
      ui.setStatus('Building update failed');
    }
    ui.setUndoAvailable(undoStore.available);
  };

  const resetCamera = (): void => {
`,
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  `    guardRoadPlan: (plan, baseRoads) =>
      guardRoadPlanWithZones(
        plan,
        baseRoads,
        zonesSnapshot,
        snapshot,
        waterSnapshot,
        EMPTY_WORLD_OCCUPANCY,
        WORLD_CONFIG,
      ),
`,
  `    guardRoadPlan: (plan, baseRoads) => {
      const zoneCandidate = guardRoadPlanWithZones(plan, baseRoads, zonesSnapshot, snapshot, waterSnapshot, createBuildingWorldOccupancy(buildingsSnapshot), WORLD_CONFIG);
      return guardRoadPlanWithBuildings(zoneCandidate, baseRoads, buildingsSnapshot, snapshot, waterSnapshot, zonesSnapshot, WORLD_CONFIG);
    },
    guardZonePlan: (plan) => guardZonePlanWithBuildings(plan, buildingsSnapshot),
`,
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "    onZonePlan: applyZonePlan,\n",
  "    onZonePlan: applyZonePlan,\n    onBuildingRequest: applyBuildingRequest,\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "        JSON.stringify(encodeWorldSaveV2(snapshot, roadsSnapshot, zonesSnapshot)),\n",
  "        JSON.stringify(encodeWorldSaveV3(snapshot, roadsSnapshot, zonesSnapshot, buildingsSnapshot)),\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "        localStorage.getItem(WORLD_SAVE_KEY) ??\n        localStorage.getItem(LEGACY_WORLD_SAVE_KEY) ??\n",
  "        localStorage.getItem(WORLD_SAVE_KEY) ??\n        localStorage.getItem(LEGACY_WORLD_SAVE_V2_KEY) ??\n        localStorage.getItem(LEGACY_WORLD_SAVE_KEY) ??\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "  ui.zoneRemoveButton.addEventListener('click', () => setToolMode('zone-remove'), listenerOptions);\n",
  "  ui.zoneRemoveButton.addEventListener('click', () => setToolMode('zone-remove'), listenerOptions);\n  ui.buildingDevelopButton.addEventListener('click', () => setToolMode('building-develop'), listenerOptions);\n  ui.buildingBulldozeButton.addEventListener('click', () => setToolMode('building-bulldoze'), listenerOptions);\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "      } else {\n        const dirtyChunks = zoneDirtyChunksBetween(zonesSnapshot, entry.zones);\n",
  "      } else if (entry.kind === 'zone') {\n        const dirtyChunks = zoneDirtyChunksBetween(zonesSnapshot, entry.zones);\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "          zonesSnapshot = entry.zones;\n          zoneUndoCount += 1;\n",
  "          zonesSnapshot = entry.zones;\n          buildingEnvironment = createBuildingDevelopmentEnvironment(snapshot, waterSnapshot, roadsSnapshot, zonesSnapshot, WORLD_CONFIG);\n          zoneUndoCount += 1;\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "        } catch {\n          ui.setStatus('Zone undo failed');\n        }\n      }\n\n      if (!succeeded)",
  `        } catch {
          ui.setStatus('Zone undo failed');
        }
      } else {
        try {
          buildingsSnapshot = entry.buildings;
          buildingPresentation.load(buildingsSnapshot);
          zoneEnvironment = createZonePlacementEnvironment(snapshot, waterSnapshot, roadsSnapshot, createBuildingWorldOccupancy(buildingsSnapshot), WORLD_CONFIG);
          buildingUndoCount += 1;
          buildingInvalidReason = null;
          ui.setBuildingCount(buildingCount(buildingsSnapshot));
          ui.setStatus('Building undone');
          succeeded = true;
        } catch {
          ui.setStatus('Building undo failed');
        }
      }

      if (!succeeded)`,
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "      zonePresentation.loadAll(zonesSnapshot);\n      rebuildSelection(selection, snapshot, selectedCell);\n",
  "      zonePresentation.loadAll(zonesSnapshot);\n      buildingPresentation.load(buildingsSnapshot);\n      rebuildSelection(selection, snapshot, selectedCell);\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "    getZoneEvidence: () => {\n",
  `    getBuildingEvidence: () => {
      const state = input.getBuildingState();
      return {
        ...state,
        committedBuildingRevision: buildingsSnapshot.revision,
        count: buildingCount(buildingsSnapshot),
        occupiedCellCount: occupiedBuildingCellCount(buildingsSnapshot),
        commitCount: buildingCommitCount,
        bulldozeCount: buildingBulldozeCount,
        undoCount: buildingUndoCount,
        terrainRevision: snapshot.revision,
        roadRevision: roadsSnapshot.revision,
        zoneRevision: zonesSnapshot.revision,
        undoKind: undoStore.kind,
        invalidReason: buildingInvalidReason,
      };
    },
    getZoneEvidence: () => {
`,
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "  ui.setZoneCounts(zoneCounts(zonesSnapshot));\n",
  "  ui.setZoneCounts(zoneCounts(zonesSnapshot));\n  ui.setBuildingCount(buildingCount(buildingsSnapshot));\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "    zonePresentation.dispose();\n",
  "    zonePresentation.dispose();\n    buildingPresentation.dispose();\n",
);

await replaceOnce(
  'apps/game/src/interaction-evidence.ts',
  "import type { TerraformBrushSize, WorldToolMode } from '@web-three-city/terrain-core';\n",
  "import type { BuildingInvalidReason } from '@web-three-city/building-core';\nimport type { TerraformBrushSize, WorldToolMode } from '@web-three-city/terrain-core';\n",
);
await replaceOnce(
  'apps/game/src/interaction-evidence.ts',
  "export interface InteractionEvidence {\n",
  `export interface BuildingInteractionEvidence {
  readonly mode: 'building-develop' | 'building-bulldoze' | null;
  readonly strokeActive: boolean;
  readonly cell: CellCoord | null;
  readonly committedBuildingRevision: number;
  readonly count: number;
  readonly occupiedCellCount: number;
  readonly commitCount: number;
  readonly bulldozeCount: number;
  readonly undoCount: number;
  readonly terrainRevision: number;
  readonly roadRevision: number;
  readonly zoneRevision: number;
  readonly undoKind: 'terraform' | 'road' | 'zone' | 'building' | null;
  readonly invalidReason: BuildingInvalidReason | null;
  readonly committedRootCount: number;
}

export interface InteractionEvidence {
`,
);
await replaceOnce(
  'apps/game/src/interaction-evidence.ts',
  "  readonly zone: ZoneInteractionEvidence;\n",
  "  readonly zone: ZoneInteractionEvidence;\n  readonly building: BuildingInteractionEvidence;\n",
);
await replaceOnce(
  'apps/game/src/interaction-evidence.ts',
  "    readonly zonePreview: number;\n",
  "    readonly zonePreview: number;\n    readonly buildingCommitted: number;\n",
);
await replaceOnce(
  'apps/game/src/interaction-evidence.ts',
  "  getZoneEvidence(): Omit<\n",
  "  getBuildingEvidence(): Omit<BuildingInteractionEvidence, 'committedRootCount'>;\n  getZoneEvidence(): Omit<\n",
);
await replaceOnce(
  'apps/game/src/interaction-evidence.ts',
  "    get zone(): ZoneInteractionEvidence {\n",
  `    get building(): BuildingInteractionEvidence {
      return { ...source.getBuildingEvidence(), committedRootCount: countRoots(source.scene, 'building-committed-root') };
    },
    get zone(): ZoneInteractionEvidence {
`,
);
await replaceOnce(
  'apps/game/src/interaction-evidence.ts',
  "        zonePreview: countZonePreviewRoots(source.scene),\n",
  "        zonePreview: countZonePreviewRoots(source.scene),\n        buildingCommitted: countRoots(source.scene, 'building-committed-root'),\n",
);
await replaceOnce(
  'apps/game/src/interaction-evidence.ts',
  "  readonly undoKind: 'terraform' | 'road' | 'zone' | null;\n",
  "  readonly undoKind: 'terraform' | 'road' | 'zone' | 'building' | null;\n",
);
await replaceOnce(
  'apps/game/src/interaction-evidence.ts',
  "  readonly undoKind: 'terraform' | 'road' | 'zone' | null;\n",
  "  readonly undoKind: 'terraform' | 'road' | 'zone' | 'building' | null;\n",
);

await write(
  'apps/game/src/world-save-building.test.ts',
  `import { describe, expect, it } from 'vitest';
import { createBuildingSnapshot } from '@web-three-city/building-core';
import { createEmptyRoadSnapshot } from '@web-three-city/road-core';
import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import { createEmptyZoneSnapshot } from '@web-three-city/zone-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { decodeWorldSave, encodeWorldSaveV2, encodeWorldSaveV3 } from './world-save.js';

describe('WorldSaveV3 buildings', () => {
  it('migrates WorldSaveV2 to empty Buildings', () => {
    const terrain = generateCoastalTerrain({ seed: 1_464_156_977, config: WORLD_CONFIG });
    if (!terrain.ok) throw new Error(terrain.error.code);
    const decoded = decodeWorldSave(encodeWorldSaveV2(terrain.value, createEmptyRoadSnapshot(WORLD_CONFIG), createEmptyZoneSnapshot(WORLD_CONFIG)), WORLD_CONFIG);
    expect(decoded.ok && decoded.value.buildings.instances).toHaveLength(0);
  });

  it('persists authoritative Building state in WorldSaveV3', () => {
    const terrain = generateCoastalTerrain({ seed: 1_464_156_977, config: WORLD_CONFIG });
    if (!terrain.ok) throw new Error(terrain.error.code);
    const buildings = createBuildingSnapshot({ revision: 0, instances: [] }, WORLD_CONFIG);
    expect(encodeWorldSaveV3(terrain.value, createEmptyRoadSnapshot(WORLD_CONFIG), createEmptyZoneSnapshot(WORLD_CONFIG), buildings)).toMatchObject({ schemaVersion: 3, buildings: { schemaVersion: 1 } });
  });
});
`,
);
await write(
  'apps/game/src/world-undo-building.test.ts',
  `import { describe, expect, it } from 'vitest';
import { createBuildingSnapshot } from '@web-three-city/building-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { WorldUndoStore } from './world-undo.js';

describe('Building Undo', () => {
  it('restores a defensive Building snapshot with a newer revision once', () => {
    const store = new WorldUndoStore(WORLD_CONFIG);
    const snapshot = createBuildingSnapshot({ revision: 3, instances: [] }, WORLD_CONFIG);
    store.replace({ kind: 'building', buildings: snapshot });
    const restored = store.consume();
    expect(restored?.kind).toBe('building');
    if (restored?.kind === 'building') expect(restored.buildings.revision).toBe(5);
    expect(store.consume()).toBeNull();
  });
});
`,
);

await write(
  'browser-tests/building.spec.ts',
  `import { expect, test } from '@playwright/test';
import { GAME_URL, readEvidence } from './helpers/interaction.js';

test('exposes Building Foundation controls and authoritative evidence', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bulldoze Building' })).toBeVisible();
  await expect(page.getByTestId('building-count')).toHaveText('0');
  const evidence = await readEvidence(page);
  expect(evidence.building.committedBuildingRevision).toBe(0);
  expect(evidence.building.count).toBe(0);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
});

test('Develop Zones fails closed before eligible Zones exist', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await page.getByRole('button', { name: 'Develop Zones' }).click();
  await page.locator('#game-canvas').click({ position: { x: 700, y: 450 } });
  await expect(page.getByTestId('game-status')).toHaveText('No eligible Zoned lots');
});
`,
);
await write(
  'browser-tests/building-visual-evidence.spec.ts',
  `import { expect, test } from '@playwright/test';
import { GAME_URL } from './helpers/interaction.js';

test('captures the Building Foundation empty-world baseline', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  await page.screenshot({ path: testInfo.outputPath('building-foundation-baseline.png'), fullPage: true });
});
`,
);
await write(
  'docs/superpowers/evidence/2026-08-03-building-content-occupancy-foundation-v0-1.md',
  `# Building Content & Occupancy Foundation v0.1 Evidence

## Status

Implementation and automated/manual test specifications are written on the feature branch. Verification is intentionally deferred until the Owner's final test pass.

## Manual acceptance matrix

1. Build a valid Road and paint homogeneous Residential, Commercial, and Industrial lots.
2. Select **Develop Zones**, release on the world, and confirm deterministic Buildings appear.
3. Confirm larger compatible definitions win when a valid 2×2 or 1×2 lot exists.
4. Confirm Building footprints never span mixed Zones, water, non-flat terrain, Roads, or existing Buildings.
5. Confirm Residential, Commercial, and Industrial prototypes are visually distinct.
6. Select **Bulldoze Building**, release on any occupied footprint cell, and confirm the whole Building disappears while the Zone remains.
7. Confirm Road, Zone, and Terraform operations reject Building-occupied cells.
8. Confirm Road bulldoze rejects removal of required Building frontage.
9. Save, mutate, load, and confirm Building instances, rotations, counts, and occupancy return.
10. Undo both development and bulldoze once and confirm the Building revision advances.
11. Confirm old WorldSaveV1/V2 data loads with an empty Building layer.
12. Confirm reload/context restoration creates exactly one `building-committed-root`.

## Verification record

- Exact head: pending
- Focused tests: not run by instruction
- `pnpm check`: not run by instruction
- Browser acceptance: not run by instruction
- Visual review: pending Owner
- Merge authorization: not granted
`,
);

console.log('Generated Building Foundation part 3');
