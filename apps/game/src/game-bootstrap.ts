import {
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
import {
  commitRoadMutation,
  createEmptyRoadSnapshot,
  occupiedRoadCellCount,
  type RoadMutationPlan,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import {
  createCoreRoadPresentationSource,
  RoadChunkPresentation,
  RoadPreviewPresentation,
} from '@web-three-city/road-three';
import {
  chunkForCell,
  commitTerraformPlan,
  terrainCellSurfaceProfile,
  type ChunkCoord,
  type TerrainSnapshot,
  type TerraformBrushSize,
  type TerraformPlan,
} from '@web-three-city/terrain-core';
import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import {
  createCoreTerrainPresentationSource,
  detectWebGL2,
  SelectedCellPresentation,
  TerrainGridPresentation,
  TerrainPresentation,
  TerraformPreviewPresentation,
} from '@web-three-city/terrain-three';
import { deriveWaterSnapshot, type WaterSnapshot } from '@web-three-city/water-core';
import {
  createCoreWaterPresentationSource,
  WaterPresentation,
  type WaterPresentationBuild,
  type WaterPresentationSource,
} from '@web-three-city/water-three';
import {
  commitZoneMutation,
  createEmptyZoneSnapshot,
  zoneCounts,
  type ZoneMutationPlan,
  type ZonePlacementEnvironment,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';
import {
  createCoreZonePresentationSource,
  ZoneChunkPresentation,
  ZonePreviewPresentation,
} from '@web-three-city/zone-three';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import * as THREE from 'three';
import { createBuildingDevelopmentEnvironment } from './building-development-environment.js';
import { createBuildingWorldOccupancy } from './building-world-occupancy.js';
import { createGameInput, type GameRenderViewport } from './game-input.js';
import { dispatchGameTransactionState } from './game-tool-events.js';
import type { BuildingToolMode, GameToolMode } from './game-tool-mode.js';
import {
  publishInteractionEvidence,
  type WaterInteractionEvidence,
} from './interaction-evidence.js';
import {
  guardRoadPlanWithBuildings,
  type GameRoadBuildingInvalidReason,
} from './road-building-guard.js';
import { guardRoadPlanWithZones } from './road-zone-guard.js';
import { createRoadPlacementEnvironment } from './road-placement-environment.js';
import { guardTerraformPlanWithOccupancy } from './terraform-occupancy-guard.js';
import { createZonePlacementEnvironment } from './zone-placement-environment.js';
import { decodeWorldSave, encodeWorldSaveV3, type DecodedWorldState } from './world-save.js';
import { guardZonePlanWithBuildings, type GameZoneInvalidReason } from './zone-building-guard.js';
import { WorldUndoStore, type WorldUndoEntry } from './world-undo.js';
import { renderGameUi, type GameViewportLayout, type QualityLevel } from './game-ui.js';

const WORLD_SAVE_KEY = 'web-three-city:world-save:v3';
const LEGACY_WORLD_SAVE_V2_KEY = 'web-three-city:world-save:v2';
const LEGACY_WORLD_SAVE_KEY = 'web-three-city:world-save:v1';
const LEGACY_TERRAIN_SAVE_KEY = 'web-three-city:terrain-save:v1';
const CURATED_SEED = 1464156977;
const WORLD_BOUNDS = Object.freeze({
  minimumWorldY: WORLD_CONFIG.dioramaBaseY,
  maximumWorldY: WORLD_CONFIG.maxHeightLevel * WORLD_CONFIG.heightStep,
});

const QUALITY_POLICY = Object.freeze({
  low: { label: 'Low', maxPixelRatio: 1, shadows: false },
  medium: { label: 'Medium', maxPixelRatio: 1.5, shadows: true },
  high: { label: 'High', maxPixelRatio: 2, shadows: true },
});

export interface GameRuntime {
  runAutomaticBuildingPass(): void;
  dispose(): void;
}

interface RuntimeWorldState {
  readonly terrain: TerrainSnapshot;
  readonly water: WaterSnapshot;
  readonly roads: RoadSnapshot;
  readonly roadEnvironment: RoadPlacementEnvironment;
  readonly zones: ZoneSnapshot;
  readonly zoneEnvironment: ZonePlacementEnvironment;
  readonly buildings: BuildingSnapshot;
  readonly buildingEnvironment: BuildingDevelopmentEnvironment;
}

function toRenderViewport(layout: GameViewportLayout): GameRenderViewport {
  return {
    left: layout.insets.left,
    top: layout.insets.top,
    width: layout.width - layout.insets.left - layout.insets.right,
    height: layout.height - layout.insets.top - layout.insets.bottom,
    canvasWidth: layout.width,
    canvasHeight: layout.height,
  };
}

function rebuildSelection(
  selection: SelectedCellPresentation,
  snapshot: TerrainSnapshot,
  selectedCell: CellCoord | null,
): void {
  selection.clear();
  if (selectedCell !== null) selection.setSelection(snapshot, selectedCell);
}

type WaterBuildMetrics = Pick<
  WaterInteractionEvidence,
  'surfaceTriangleCount' | 'shorelineTriangleCount' | 'wallSegmentCount' | 'estimatedGeometryBytes'
>;

function summarizeWaterBuild(build: WaterPresentationBuild): WaterBuildMetrics {
  let surfaceTriangleCount = 0;
  let shorelineTriangleCount = 0;
  let estimatedGeometryBytes = 0;
  for (const chunk of build.chunks) {
    surfaceTriangleCount += chunk.surfaceTriangleCount;
    shorelineTriangleCount += chunk.shorelineTriangleCount;
    estimatedGeometryBytes +=
      chunk.surfacePositions.byteLength +
      chunk.surfaceNormals.byteLength +
      chunk.surfaceColors.byteLength +
      chunk.surfaceIndices.byteLength +
      chunk.shorelinePositions.byteLength +
      chunk.shorelineColors.byteLength +
      chunk.shorelineIndices.byteLength;
  }
  estimatedGeometryBytes +=
    build.wall.positions.byteLength +
    build.wall.normals.byteLength +
    build.wall.colors.byteLength +
    build.wall.indices.byteLength;
  return {
    surfaceTriangleCount,
    shorelineTriangleCount,
    wallSegmentCount: build.wall.segmentCount,
    estimatedGeometryBytes,
  };
}

function requireWater(snapshot: TerrainSnapshot): WaterSnapshot {
  const result = deriveWaterSnapshot(snapshot, WORLD_CONFIG);
  if (!result.ok) throw new Error(`game:water-derivation-failed:${result.error.code}`);
  return result.value;
}

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
    buildingEnvironment: createBuildingDevelopmentEnvironment(
      terrain,
      water,
      roads,
      zones,
      WORLD_CONFIG,
    ),
  });
}

function frozenDirtyChunks(chunks: Iterable<ChunkCoord>): readonly ChunkCoord[] {
  const unique = new Map<string, ChunkCoord>();
  for (const chunk of chunks) unique.set(`${chunk.x}:${chunk.z}`, chunk);
  return Object.freeze(
    [...unique.values()]
      .map((chunk) => Object.freeze({ x: chunk.x, z: chunk.z }))
      .sort((first, second) => first.z - second.z || first.x - second.x),
  );
}

function roadDirtyChunksBetween(before: RoadSnapshot, after: RoadSnapshot): readonly ChunkCoord[] {
  const beforeCodes = before.definitionCodes;
  const afterCodes = after.definitionCodes;
  const chunks: ChunkCoord[] = [];
  for (let z = 0; z < WORLD_CONFIG.mapHeight; z += 1) {
    for (let x = 0; x < WORLD_CONFIG.mapWidth; x += 1) {
      const index = z * WORLD_CONFIG.mapWidth + x;
      if (beforeCodes[index] === afterCodes[index]) continue;
      for (const cell of [
        { x, z },
        { x, z: z - 1 },
        { x: x + 1, z },
        { x, z: z + 1 },
        { x: x - 1, z },
      ]) {
        if (
          cell.x >= 0 &&
          cell.z >= 0 &&
          cell.x < WORLD_CONFIG.mapWidth &&
          cell.z < WORLD_CONFIG.mapHeight
        ) {
          chunks.push(chunkForCell(cell, WORLD_CONFIG));
        }
      }
    }
  }
  return frozenDirtyChunks(chunks);
}

function zoneDirtyChunksBetween(before: ZoneSnapshot, after: ZoneSnapshot): readonly ChunkCoord[] {
  const beforeCodes = before.definitionCodes;
  const afterCodes = after.definitionCodes;
  const chunks: ChunkCoord[] = [];
  for (let z = 0; z < WORLD_CONFIG.mapHeight; z += 1) {
    for (let x = 0; x < WORLD_CONFIG.mapWidth; x += 1) {
      const index = z * WORLD_CONFIG.mapWidth + x;
      if (beforeCodes[index] !== afterCodes[index]) {
        chunks.push(chunkForCell({ x, z }, WORLD_CONFIG));
      }
    }
  }
  return frozenDirtyChunks(chunks);
}

function geometryAttributeByteLength(attribute: unknown): number {
  if (attribute instanceof THREE.BufferAttribute) return attribute.array.byteLength;
  if (attribute instanceof THREE.InterleavedBufferAttribute) {
    return attribute.data.array.byteLength;
  }
  return 0;
}

function roadGeometryBytes(scene: THREE.Scene): number {
  const root = scene.getObjectByName('road-committed-root');
  if (root === undefined) return 0;
  let bytes = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const attribute of Object.values(object.geometry.attributes)) {
      bytes += geometryAttributeByteLength(attribute);
    }
    if (object.geometry.index !== null) bytes += object.geometry.index.array.byteLength;
  });
  return bytes;
}

function statusForRoadPlan(
  plan: RoadMutationPlan,
  reason: GameRoadBuildingInvalidReason | null = plan.invalidReason,
): string {
  if (plan.valid) return plan.operation === 'build' ? 'Road built' : 'Road bulldozed';
  if (reason === 'road:zone-occupied') return 'Road blocked by zone';
  if (reason === 'road:zone-access-lost') return 'Road required by zone';
  if (reason === 'road:building-occupied') return 'Road blocked by building';
  if (reason === 'road:building-access-lost') return 'Road required by building';
  if (reason === 'road:wet-cell') return 'Road blocked by water';
  if (reason === 'road:invalid-ramp-topology') return 'Road rejected on ramp';
  if (reason === 'road:unsupported-terrain') return 'Road terrain unsupported';
  if (reason === 'road:no-change') return 'Road unchanged';
  return 'Road rejected';
}

function statusForZonePlan(
  plan: ZoneMutationPlan,
  routedReason: GameZoneInvalidReason | null = plan.invalidReason,
): string {
  if (plan.valid && routedReason === null)
    return plan.operation === 'paint' ? 'Zone painted' : 'Zone removed';
  if (routedReason === 'zone:building-occupied') return 'Zone blocked by building';
  if (plan.invalidReason === 'zone:road-access-required') return 'Zone needs road access';
  if (plan.invalidReason === 'zone:wet-cell') return 'Zone blocked by water';
  if (plan.invalidReason === 'zone:unsupported-terrain') return 'Zone requires flat terrain';
  if (plan.invalidReason === 'zone:road-occupied') return 'Zone overlaps road';
  if (plan.invalidReason === 'zone:zone-conflict') return 'Remove existing zone first';
  if (plan.invalidReason === 'zone:no-change') return 'Zone unchanged';
  return 'Zone rejected';
}

function statusForBuildingPlan(plan: BuildingMutationPlan): string {
  if (plan.valid) return plan.operation === 'develop' ? 'Zones developed' : 'Building bulldozed';
  if (plan.invalidReason === 'building:no-zoned-lot') return 'No eligible Zoned lots';
  if (plan.invalidReason === 'building:not-found') return 'No building selected';
  if (plan.invalidReason === 'building:road-access-required') return 'Building needs Road frontage';
  if (plan.invalidReason === 'building:mixed-zone') return 'Building lot spans mixed Zones';
  if (plan.invalidReason === 'building:wet-cell') return 'Building blocked by water';
  if (plan.invalidReason === 'building:unsupported-terrain')
    return 'Building requires flat terrain';
  return 'Building rejected';
}

export function bootstrapGame(root: HTMLElement): GameRuntime {
  const ui = renderGameUi(root);
  const capability = detectWebGL2(ui.canvas);
  if (!capability.supported) {
    ui.setStatus('WebGL2 unavailable');
    return { runAutomaticBuildingPass(): void {}, dispose(): void {} };
  }

  const generated = generateCoastalTerrain({ seed: CURATED_SEED, config: WORLD_CONFIG });
  if (!generated.ok) throw new Error(`game:generation-failed:${generated.error.code}`);
  const initialWaterDerivationStart = performance.now();
  let snapshot = generated.value;
  let waterSnapshot = requireWater(snapshot);
  let roadsSnapshot = createEmptyRoadSnapshot(WORLD_CONFIG);
  let zonesSnapshot = createEmptyZoneSnapshot(WORLD_CONFIG);
  let buildingsSnapshot = createEmptyBuildingSnapshot(WORLD_CONFIG);
  let roadEnvironment = createRoadPlacementEnvironment(snapshot, waterSnapshot, WORLD_CONFIG);
  let zoneEnvironment = createZonePlacementEnvironment(
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
  let waterDerivationDurationMs = performance.now() - initialWaterDerivationStart;
  let waterPresentationDurationMs = 0;
  let waterBuildMetrics: WaterBuildMetrics = {
    surfaceTriangleCount: 0,
    shorelineTriangleCount: 0,
    wallSegmentCount: 0,
    estimatedGeometryBytes: 0,
  };
  let stagedWaterBuildMetrics = waterBuildMetrics;
  let replacingWorld = false;
  let selectedCell: CellCoord | null = null;
  let contextLost = false;
  let disposed = false;
  let animationFrame = 0;
  let terraformCommitCount = 0;
  let terraformUndoCount = 0;
  let terraformWaterRebuildCount = 0;
  let roadCommitCount = 0;
  let roadBulldozeCount = 0;
  let roadUndoCount = 0;
  let roadLastDirtyChunkCount = 0;
  let roadChunkRebuildCount = 0;
  let zoneCommitCount = 0;
  let zoneRemoveCount = 0;
  let zoneUndoCount = 0;
  let zoneLastDirtyChunkCount = 0;
  let zoneChunkRebuildCount = 0;
  let zoneInvalidReason: GameZoneInvalidReason | null = null;
  let buildingCommitCount = 0;
  let buildingBulldozeCount = 0;
  let buildingUndoCount = 0;
  let buildingInvalidReason: BuildingMutationPlan['invalidReason'] = null;
  let renderViewport: GameRenderViewport = {
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    canvasWidth: 1,
    canvasHeight: 1,
  };

  const renderer = new THREE.WebGLRenderer({
    canvas: ui.canvas,
    context: capability.context,
    antialias: true,
  });
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xcfe4ef, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe4ef);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4f5b45, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-60, 100, -30);
  scene.add(sun);

  const camera = new THREE.OrthographicCamera();
  const cameraRig = new OrthographicCameraRig(camera, WORLD_CONFIG);
  const terrain = new TerrainPresentation(
    scene,
    createCoreTerrainPresentationSource(WORLD_CONFIG),
    WORLD_CONFIG,
  );
  const coreWaterSource = createCoreWaterPresentationSource(WORLD_CONFIG);
  const measuredWaterSource: WaterPresentationSource = {
    buildAll(terrainSnapshot, nextWaterSnapshot) {
      const build = coreWaterSource.buildAll(terrainSnapshot, nextWaterSnapshot);
      stagedWaterBuildMetrics = summarizeWaterBuild(build);
      return build;
    },
  };
  const water = new WaterPresentation(scene, measuredWaterSource, WORLD_CONFIG);
  const roadSource = createCoreRoadPresentationSource(WORLD_CONFIG);
  const roadPresentation = new RoadChunkPresentation(scene, roadSource, WORLD_CONFIG);
  const roadPreview = new RoadPreviewPresentation(scene, roadSource, WORLD_CONFIG);
  let zoneSurfaceSnapshot = snapshot;
  const zoneSource = createCoreZonePresentationSource(
    (cell) => terrainCellSurfaceProfile(zoneSurfaceSnapshot, cell, WORLD_CONFIG),
    WORLD_CONFIG,
  );
  const zonePresentation = new ZoneChunkPresentation(scene, zoneSource, WORLD_CONFIG);
  const zonePreview = new ZonePreviewPresentation(
    scene,
    (cell) => terrainCellSurfaceProfile(zoneSurfaceSnapshot, cell, WORLD_CONFIG),
    WORLD_CONFIG,
  );
  const buildingPresentation = new BuildingPresentation(
    scene,
    (cell) =>
      terrainCellSurfaceProfile(zoneSurfaceSnapshot, cell, WORLD_CONFIG).minimumLevel *
      WORLD_CONFIG.heightStep,
    WORLD_CONFIG,
  );

  terrain.load(snapshot);
  const initialWaterPresentationStart = performance.now();
  water.load(snapshot, waterSnapshot);
  waterPresentationDurationMs = performance.now() - initialWaterPresentationStart;
  waterBuildMetrics = stagedWaterBuildMetrics;
  roadPresentation.loadAll(roadsSnapshot, roadEnvironment);
  zonePresentation.loadAll(zonesSnapshot);
  buildingPresentation.load(buildingsSnapshot);

  const grid = new TerrainGridPresentation(scene, WORLD_CONFIG);
  grid.setVisible(false);
  grid.load(snapshot);
  const selection = new SelectedCellPresentation(scene, WORLD_CONFIG);
  const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);
  const undoStore = new WorldUndoStore(WORLD_CONFIG);

  const setSelection = (cell: CellCoord | null): void => {
    selectedCell = cell === null ? null : { ...cell };
    ui.setSelectedCell(selectedCell);
    if (selectedCell === null) selection.clear();
    else selection.setSelection(snapshot, selectedCell);
  };

  const inputRef: { current: ReturnType<typeof createGameInput> | null } = { current: null };

  const replaceCompleteWorld = (
    nextWorld: RuntimeWorldState | DecodedWorldState,
    successStatus: string,
  ): boolean => {
    const previousWorld: RuntimeWorldState = {
      terrain: snapshot,
      water: waterSnapshot,
      roads: roadsSnapshot,
      roadEnvironment,
      zones: zonesSnapshot,
      zoneEnvironment,
      buildings: buildingsSnapshot,
      buildingEnvironment,
    };
    replacingWorld = true;
    try {
      terrain.load(nextWorld.terrain);
      const presentationStart = performance.now();
      water.load(nextWorld.terrain, nextWorld.water);
      const nextWaterPresentationDurationMs = performance.now() - presentationStart;
      grid.load(nextWorld.terrain);
      roadPresentation.loadAll(nextWorld.roads, nextWorld.roadEnvironment);
      zoneSurfaceSnapshot = nextWorld.terrain;
      zonePresentation.loadAll(nextWorld.zones);
      buildingPresentation.load(nextWorld.buildings);
      rebuildSelection(selection, nextWorld.terrain, selectedCell);
      inputRef.current?.refreshTerrainObjects();

      snapshot = nextWorld.terrain;
      waterSnapshot = nextWorld.water;
      roadsSnapshot = nextWorld.roads;
      roadEnvironment = nextWorld.roadEnvironment;
      zonesSnapshot = nextWorld.zones;
      zoneEnvironment = nextWorld.zoneEnvironment;
      buildingsSnapshot = nextWorld.buildings;
      buildingEnvironment = nextWorld.buildingEnvironment;
      ui.setZoneCounts(zoneCounts(zonesSnapshot));
      ui.setBuildingCount(buildingCount(buildingsSnapshot));
      waterPresentationDurationMs = nextWaterPresentationDurationMs;
      waterBuildMetrics = stagedWaterBuildMetrics;
      ui.setStatus(successStatus);
      return true;
    } catch {
      try {
        terrain.load(previousWorld.terrain);
        water.load(previousWorld.terrain, previousWorld.water);
        grid.load(previousWorld.terrain);
        roadPresentation.loadAll(previousWorld.roads, previousWorld.roadEnvironment);
        zoneSurfaceSnapshot = previousWorld.terrain;
        zonePresentation.loadAll(previousWorld.zones);
        buildingPresentation.load(previousWorld.buildings);
        rebuildSelection(selection, previousWorld.terrain, selectedCell);
        inputRef.current?.refreshTerrainObjects();
        waterBuildMetrics = stagedWaterBuildMetrics;
      } catch {
        // Context restoration can rebuild the last committed authoritative world.
      }
      ui.setStatus('World update failed');
      return false;
    } finally {
      replacingWorld = false;
    }
  };

  const replaceTerrainWorld = (nextSnapshot: TerrainSnapshot, successStatus: string): boolean => {
    const derivationStart = performance.now();
    let nextWorld: RuntimeWorldState;
    try {
      nextWorld = stageTerrainWorld(nextSnapshot, roadsSnapshot, zonesSnapshot, buildingsSnapshot);
    } catch {
      ui.setStatus('World update failed');
      return false;
    }
    const nextDerivationDurationMs = performance.now() - derivationStart;
    if (!replaceCompleteWorld(nextWorld, successStatus)) return false;
    waterDerivationDurationMs = nextDerivationDurationMs;
    return true;
  };

  const applyTerraformPlan = (plan: TerraformPlan): void => {
    const candidate = guardTerraformPlanWithOccupancy(
      plan,
      roadsSnapshot,
      zonesSnapshot,
      buildingsSnapshot,
    );
    if (!candidate.valid) {
      ui.setStatus(
        candidate.invalidReason === 'terraform:building-occupied'
          ? 'Terraform blocked by building'
          : candidate.invalidReason === 'terraform:zone-occupied'
            ? 'Terraform blocked by zone'
            : candidate.invalidReason === 'terraform:road-occupied'
              ? 'Terraform blocked by road'
              : 'Terraform rejected',
      );
      ui.setUndoAvailable(undoStore.available);
      return;
    }

    const before = snapshot;
    try {
      const committed = commitTerraformPlan(snapshot, plan, WORLD_CONFIG);
      if (replaceTerrainWorld(committed.snapshot, 'Terraform applied')) {
        undoStore.replace({ kind: 'terraform', terrain: before });
        terraformCommitCount += 1;
        terraformWaterRebuildCount += 1;
      }
    } catch {
      ui.setStatus('Terraform rejected');
    }
    ui.setUndoAvailable(undoStore.available);
  };

  const applyRoadPlan = (
    plan: RoadMutationPlan,
    routedReason: GameRoadBuildingInvalidReason | null = null,
  ): void => {
    const zoneCandidate = guardRoadPlanWithZones(
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
    const reason = routedReason ?? candidate.invalidReason;
    if (!candidate.valid) {
      ui.setStatus(statusForRoadPlan(candidate.previewPlan, reason));
      ui.setUndoAvailable(undoStore.available);
      return;
    }

    const before = roadsSnapshot;
    try {
      const committed = commitRoadMutation(
        roadsSnapshot,
        candidate.corePlan,
        roadEnvironment,
        WORLD_CONFIG,
      );
      roadPresentation.rebuildDirty(
        committed.snapshot,
        roadEnvironment,
        committed.receipt.dirtyChunks,
      );
      roadsSnapshot = committed.snapshot;
      zoneEnvironment = createZonePlacementEnvironment(
        snapshot,
        waterSnapshot,
        roadsSnapshot,
        createBuildingWorldOccupancy(buildingsSnapshot),
        WORLD_CONFIG,
      );
      buildingEnvironment = createBuildingDevelopmentEnvironment(
        snapshot,
        waterSnapshot,
        roadsSnapshot,
        zonesSnapshot,
        WORLD_CONFIG,
      );
      undoStore.replace({ kind: 'road', roads: before });
      roadLastDirtyChunkCount = committed.receipt.dirtyChunks.length;
      roadChunkRebuildCount += committed.receipt.dirtyChunks.length;
      if (committed.receipt.addedCellCount > 0) roadCommitCount += 1;
      if (committed.receipt.removedCellCount > 0) roadBulldozeCount += 1;
      ui.setStatus(statusForRoadPlan(candidate.corePlan));
    } catch {
      ui.setStatus('Road update failed');
    }
    ui.setUndoAvailable(undoStore.available);
  };

  const applyZonePlan = (
    plan: ZoneMutationPlan,
    routedReason: GameZoneInvalidReason | null = plan.invalidReason,
  ): void => {
    zoneInvalidReason = routedReason;
    const candidate = guardZonePlanWithBuildings(plan, buildingsSnapshot);
    const reason = routedReason ?? candidate.invalidReason;
    if (!candidate.valid || reason !== null) {
      ui.setStatus(statusForZonePlan(candidate.previewPlan, reason));
      ui.setUndoAvailable(undoStore.available);
      return;
    }

    const before = zonesSnapshot;
    try {
      const committed = commitZoneMutation(
        zonesSnapshot,
        candidate.corePlan,
        zoneEnvironment,
        WORLD_CONFIG,
      );
      zonePresentation.rebuildDirty(committed.snapshot, committed.receipt.dirtyChunks);
      zonesSnapshot = committed.snapshot;
      buildingEnvironment = createBuildingDevelopmentEnvironment(
        snapshot,
        waterSnapshot,
        roadsSnapshot,
        zonesSnapshot,
        WORLD_CONFIG,
      );
      undoStore.replace({ kind: 'zone', zones: before });
      zoneLastDirtyChunkCount = committed.receipt.dirtyChunks.length;
      zoneChunkRebuildCount += committed.receipt.dirtyChunks.length;
      if (candidate.corePlan.operation === 'paint') zoneCommitCount += 1;
      else zoneRemoveCount += 1;
      zoneInvalidReason = null;
      ui.setZoneCounts(zoneCounts(zonesSnapshot));
      ui.setStatus(statusForZonePlan(candidate.corePlan));
    } catch {
      ui.setStatus('Zone update failed');
    }
    ui.setUndoAvailable(undoStore.available);
  };

  const commitBuildingPlan = (
  plan: BuildingMutationPlan,
  interaction: 'interactive' | 'background',
): void => {
  const interactive = interaction === 'interactive';
  if (interactive) buildingInvalidReason = plan.invalidReason;
  if (!plan.valid) {
    if (interactive) {
      ui.setStatus(statusForBuildingPlan(plan));
      ui.setUndoAvailable(undoStore.available);
    }
    return;
  }
  const before = buildingsSnapshot;
  if (interactive) dispatchGameTransactionState(ui.canvas, 'committing', 'building');
  try {
    const committed = commitBuildingMutation(
      buildingsSnapshot,
      plan,
      buildingEnvironment,
      WORLD_CONFIG,
    );
    buildingsSnapshot = committed.snapshot;
    buildingPresentation.load(buildingsSnapshot);
    zoneEnvironment = createZonePlacementEnvironment(
      snapshot,
      waterSnapshot,
      roadsSnapshot,
      createBuildingWorldOccupancy(buildingsSnapshot),
      WORLD_CONFIG,
    );
    undoStore.replace({ kind: 'building', buildings: before });
    if (plan.operation === 'develop') buildingCommitCount += 1;
    else buildingBulldozeCount += 1;
    buildingInvalidReason = null;
    ui.setBuildingCount(buildingCount(buildingsSnapshot));
    if (interactive) ui.setStatus(statusForBuildingPlan(plan));
  } catch {
    if (interactive) ui.setStatus('Building update failed');
  }
  if (interactive) ui.setUndoAvailable(undoStore.available);
};

const applyBuildingRequest = (mode: BuildingToolMode, cell: CellCoord): void => {
  const plan =
    mode === 'building-develop'
      ? planBuildingDevelopment(buildingsSnapshot, buildingEnvironment, WORLD_CONFIG)
      : planBuildingBulldoze(buildingsSnapshot, cell, buildingEnvironment, WORLD_CONFIG);
  commitBuildingPlan(plan, 'interactive');
};

const runAutomaticBuildingPass = (): void => {
  const plan = planBuildingDevelopment(buildingsSnapshot, buildingEnvironment, WORLD_CONFIG);
  commitBuildingPlan(plan, 'background');
};

const resetCamera = (): void => {
    const layout = ui.measureViewport();
    ui.setControlsMode(layout.mode);
    cameraRig.setViewport(layout.width, layout.height, layout.insets);
    cameraRig.resetToFit(WORLD_BOUNDS);
    renderViewport = toRenderViewport(layout);
    inputRef.current?.setViewport(renderViewport);
  };

  const input = createGameInput({
    canvas: ui.canvas,
    camera,
    cameraRig,
    terrain,
    preview,
    roadPreview,
    zonePreview,
    config: WORLD_CONFIG,
    getTerrainSnapshot: () => snapshot,
    getRoadSnapshot: () => roadsSnapshot,
    getRoadEnvironment: () => roadEnvironment,
    getZoneSnapshot: () => zonesSnapshot,
    getZoneEnvironment: () => zoneEnvironment,
    getBuildingSnapshot: () => buildingsSnapshot,
    guardRoadPlan: (plan, baseRoads) => {
      const zoneCandidate = guardRoadPlanWithZones(
        plan,
        baseRoads,
        zonesSnapshot,
        snapshot,
        waterSnapshot,
        createBuildingWorldOccupancy(buildingsSnapshot),
        WORLD_CONFIG,
      );
      return guardRoadPlanWithBuildings(
        zoneCandidate,
        baseRoads,
        buildingsSnapshot,
        snapshot,
        waterSnapshot,
        zonesSnapshot,
        WORLD_CONFIG,
      );
    },
    guardZonePlan: (plan) => guardZonePlanWithBuildings(plan, buildingsSnapshot),
    onSelection: setSelection,
    onTerraformCommit: applyTerraformPlan,
    onRoadPlan: applyRoadPlan,
    onZonePlan: applyZonePlan,
    onBuildingRequest: applyBuildingRequest,
    onReset: resetCamera,
  });
  inputRef.current = input;

  let viewportInitialized = false;
  const updateViewport = (): void => {
    const layout = ui.measureViewport();
    ui.setControlsMode(layout.mode);
    renderer.setSize(layout.width, layout.height, false);
    if (viewportInitialized) {
      cameraRig.resizePreservingRelativeZoom(
        layout.width,
        layout.height,
        layout.insets,
        WORLD_BOUNDS,
      );
    } else {
      cameraRig.setViewport(layout.width, layout.height, layout.insets);
      cameraRig.fitToWorld(WORLD_BOUNDS);
      viewportInitialized = true;
    }
    renderViewport = toRenderViewport(layout);
    input.setViewport(renderViewport);
  };

  const applyQuality = (quality: QualityLevel): void => {
    const policy = QUALITY_POLICY[quality];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, policy.maxPixelRatio));
    renderer.shadowMap.enabled = policy.shadows;
    ui.setQuality(policy.label);
    updateViewport();
  };

  const setToolMode = (mode: GameToolMode): void => {
    input.setToolMode(mode);
    ui.setToolMode(mode);
    if (mode !== 'navigate' && !grid.visible) {
      grid.setVisible(true);
      ui.setGridVisible(true);
    }
  };

  const setBrushSize = (size: TerraformBrushSize): void => {
    input.setBrushSize(size);
    ui.setBrushSize(size);
  };

  updateViewport();
  applyQuality('medium');

  const abortController = new AbortController();
  const listenerOptions = { signal: abortController.signal };

  ui.qualitySelect.addEventListener(
    'change',
    () => applyQuality(ui.qualitySelect.value as QualityLevel),
    listenerOptions,
  );
  ui.saveButton.addEventListener(
    'click',
    () => {
      input.clearActiveSession();
      localStorage.setItem(
        WORLD_SAVE_KEY,
        JSON.stringify(
          encodeWorldSaveV3(snapshot, roadsSnapshot, zonesSnapshot, buildingsSnapshot),
        ),
      );
      ui.setStatus('Saved');
    },
    listenerOptions,
  );
  ui.loadButton.addEventListener(
    'click',
    () => {
      input.clearActiveSession();
      const saved =
        localStorage.getItem(WORLD_SAVE_KEY) ??
        localStorage.getItem(LEGACY_WORLD_SAVE_V2_KEY) ??
        localStorage.getItem(LEGACY_WORLD_SAVE_KEY) ??
        localStorage.getItem(LEGACY_TERRAIN_SAVE_KEY);
      if (saved === null) {
        ui.setStatus('No save');
        return;
      }
      try {
        const decoded = decodeWorldSave(JSON.parse(saved) as unknown, WORLD_CONFIG);
        if (!decoded.ok) {
          ui.setStatus('Invalid save');
          return;
        }
        if (replaceCompleteWorld(decoded.value, 'Loaded')) {
          undoStore.clear();
          ui.setUndoAvailable(false);
        }
      } catch {
        ui.setStatus('Invalid save');
      }
    },
    listenerOptions,
  );
  ui.rotateLeftButton.addEventListener(
    'click',
    () => input.controller.rotateLeft(),
    listenerOptions,
  );
  ui.rotateRightButton.addEventListener(
    'click',
    () => input.controller.rotateRight(),
    listenerOptions,
  );
  ui.resetButton.addEventListener('click', resetCamera, listenerOptions);
  ui.gridButton.addEventListener(
    'click',
    () => {
      grid.setVisible(!grid.visible);
      ui.setGridVisible(grid.visible);
    },
    listenerOptions,
  );
  ui.navigateButton.addEventListener('click', () => setToolMode('navigate'), listenerOptions);
  ui.raiseButton.addEventListener('click', () => setToolMode('raise'), listenerOptions);
  ui.lowerButton.addEventListener('click', () => setToolMode('lower'), listenerOptions);
  ui.flattenButton.addEventListener('click', () => setToolMode('flatten'), listenerOptions);
  ui.roadBuildButton.addEventListener('click', () => setToolMode('road-build'), listenerOptions);
  ui.roadBulldozeButton.addEventListener(
    'click',
    () => setToolMode('road-bulldoze'),
    listenerOptions,
  );
  ui.zoneResidentialButton.addEventListener(
    'click',
    () => setToolMode('zone-residential'),
    listenerOptions,
  );
  ui.zoneCommercialButton.addEventListener(
    'click',
    () => setToolMode('zone-commercial'),
    listenerOptions,
  );
  ui.zoneIndustrialButton.addEventListener(
    'click',
    () => setToolMode('zone-industrial'),
    listenerOptions,
  );
  ui.zoneRemoveButton.addEventListener('click', () => setToolMode('zone-remove'), listenerOptions);
  ui.buildingDevelopButton.addEventListener(
    'click',
    () => setToolMode('building-develop'),
    listenerOptions,
  );
  ui.buildingBulldozeButton.addEventListener(
    'click',
    () => setToolMode('building-bulldoze'),
    listenerOptions,
  );
  ui.brush1Button.addEventListener('click', () => setBrushSize(1), listenerOptions);
  ui.brush3Button.addEventListener('click', () => setBrushSize(3), listenerOptions);
  ui.brush5Button.addEventListener('click', () => setBrushSize(5), listenerOptions);
  ui.undoButton.addEventListener(
    'click',
    () => {
      input.clearActiveSession();
      const entry = undoStore.consume();
      if (entry === null) return;

      let succeeded = false;
      if (entry.kind === 'terraform') {
        succeeded = replaceTerrainWorld(entry.terrain, 'Terraform undone');
        if (succeeded) {
          terraformUndoCount += 1;
          terraformWaterRebuildCount += 1;
        }
      } else if (entry.kind === 'road') {
        const dirtyChunks = roadDirtyChunksBetween(roadsSnapshot, entry.roads);
        try {
          roadPresentation.rebuildDirty(entry.roads, roadEnvironment, dirtyChunks);
          roadsSnapshot = entry.roads;
          zoneEnvironment = createZonePlacementEnvironment(
            snapshot,
            waterSnapshot,
            roadsSnapshot,
            createBuildingWorldOccupancy(buildingsSnapshot),
            WORLD_CONFIG,
          );
          buildingEnvironment = createBuildingDevelopmentEnvironment(
            snapshot,
            waterSnapshot,
            roadsSnapshot,
            zonesSnapshot,
            WORLD_CONFIG,
          );
          roadUndoCount += 1;
          roadLastDirtyChunkCount = dirtyChunks.length;
          roadChunkRebuildCount += dirtyChunks.length;
          ui.setStatus('Road undone');
          succeeded = true;
        } catch {
          ui.setStatus('Road undo failed');
        }
      } else if (entry.kind === 'zone') {
        const dirtyChunks = zoneDirtyChunksBetween(zonesSnapshot, entry.zones);
        try {
          zonePresentation.rebuildDirty(entry.zones, dirtyChunks);
          zonesSnapshot = entry.zones;
          buildingEnvironment = createBuildingDevelopmentEnvironment(
            snapshot,
            waterSnapshot,
            roadsSnapshot,
            zonesSnapshot,
            WORLD_CONFIG,
          );
          zoneUndoCount += 1;
          zoneLastDirtyChunkCount = dirtyChunks.length;
          zoneChunkRebuildCount += dirtyChunks.length;
          zoneInvalidReason = null;
          ui.setZoneCounts(zoneCounts(zonesSnapshot));
          ui.setStatus('Zone undone');
          succeeded = true;
        } catch {
          ui.setStatus('Zone undo failed');
        }
      } else {
        try {
          buildingsSnapshot = entry.buildings;
          buildingPresentation.load(buildingsSnapshot);
          zoneEnvironment = createZonePlacementEnvironment(
            snapshot,
            waterSnapshot,
            roadsSnapshot,
            createBuildingWorldOccupancy(buildingsSnapshot),
            WORLD_CONFIG,
          );
          buildingUndoCount += 1;
          buildingInvalidReason = null;
          ui.setBuildingCount(buildingCount(buildingsSnapshot));
          ui.setStatus('Building undone');
          succeeded = true;
        } catch {
          ui.setStatus('Building undo failed');
        }
      }

      if (!succeeded) undoStore.replace(entry as WorldUndoEntry);
      ui.setUndoAvailable(undoStore.available);
    },
    listenerOptions,
  );
  window.addEventListener('resize', updateViewport, listenerOptions);

  ui.canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      contextLost = true;
      input.clearActiveSession();
      ui.setStatus('Context lost');
    },
    listenerOptions,
  );
  ui.canvas.addEventListener(
    'webglcontextrestored',
    () => {
      preview.clear();
      roadPreview.clear();
      zonePreview.clear();
      terrain.load(snapshot);
      const presentationStart = performance.now();
      water.load(snapshot, waterSnapshot);
      waterPresentationDurationMs = performance.now() - presentationStart;
      waterBuildMetrics = stagedWaterBuildMetrics;
      grid.load(snapshot);
      roadPresentation.loadAll(roadsSnapshot, roadEnvironment);
      zoneSurfaceSnapshot = snapshot;
      zonePresentation.loadAll(zonesSnapshot);
      buildingPresentation.load(buildingsSnapshot);
      rebuildSelection(selection, snapshot, selectedCell);
      input.refreshTerrainObjects();
      contextLost = false;
      ui.setStatus('Ready');
    },
    listenerOptions,
  );

  publishInteractionEvidence({
    camera,
    cameraRig,
    config: WORLD_CONFIG,
    scene,
    input,
    getViewport: () => renderViewport,
    getSelectedCell: () => selectedCell,
    getGridVisible: () => grid.visible,
    getWaterEvidence: () => ({
      sourceTerrainRevision: waterSnapshot.sourceTerrainRevision,
      seaTriangleCount: waterSnapshot.seaTriangleCount,
      enclosedWetTriangleCount: waterSnapshot.enclosedWetTriangleCount,
      shorelineSegmentCount: waterSnapshot.shorelineSegmentCount,
      ...waterBuildMetrics,
      derivationDurationMs: waterDerivationDurationMs,
      presentationDurationMs: waterPresentationDurationMs,
    }),
    getTerraformEvidence: () => {
      const state = input.getTerraformState();
      return {
        ...state,
        committedTerrainRevision: snapshot.revision,
        waterSourceTerrainRevision: waterSnapshot.sourceTerrainRevision,
        undoAvailable: undoStore.available,
        commitCount: terraformCommitCount,
        undoCount: terraformUndoCount,
        waterRebuildCount: terraformWaterRebuildCount,
      };
    },
    getRoadEvidence: () => {
      const state = input.getRoadState();
      return {
        ...state,
        committedRoadRevision: roadsSnapshot.revision,
        occupiedCellCount: occupiedRoadCellCount(roadsSnapshot),
        commitCount: roadCommitCount,
        bulldozeCount: roadBulldozeCount,
        undoCount: roadUndoCount,
        lastDirtyChunkCount: roadLastDirtyChunkCount,
        chunkRebuildCount: roadChunkRebuildCount,
        terrainRevision: snapshot.revision,
        waterSourceTerrainRevision: waterSnapshot.sourceTerrainRevision,
        undoKind: undoStore.kind,
        estimatedGeometryBytes: roadGeometryBytes(scene),
      };
    },
    getBuildingEvidence: () => {
      const state = input.getBuildingState();
      return {
        ...state,
        committedBuildingRevision: buildingsSnapshot.revision,
        count: buildingCount(buildingsSnapshot),
        occupiedCellCount: occupiedBuildingCellCount(buildingsSnapshot),
        definitionIds: Object.freeze(
          buildingsSnapshot.instances
            .map((instance) => instance.buildingDefinitionId)
            .sort((first, second) => first.localeCompare(second)),
        ),
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
      const state = input.getZoneState();
      return {
        ...state,
        committedZoneRevision: zonesSnapshot.revision,
        counts: zoneCounts(zonesSnapshot),
        commitCount: zoneCommitCount,
        removeCount: zoneRemoveCount,
        undoCount: zoneUndoCount,
        lastDirtyChunkCount: zoneLastDirtyChunkCount,
        chunkRebuildCount: zoneChunkRebuildCount,
        terrainRevision: snapshot.revision,
        waterSourceTerrainRevision: waterSnapshot.sourceTerrainRevision,
        roadRevision: roadsSnapshot.revision,
        undoKind: undoStore.kind,
        invalidReason: state.previewInvalidReason ?? zoneInvalidReason,
      };
    },
  });

  const render = (): void => {
    if (!contextLost && !replacingWorld) {
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, renderViewport.canvasWidth, renderViewport.canvasHeight);
      renderer.clear(true, true, true);
      const viewportBottom =
        renderViewport.canvasHeight - renderViewport.top - renderViewport.height;
      renderer.setViewport(
        renderViewport.left,
        viewportBottom,
        renderViewport.width,
        renderViewport.height,
      );
      renderer.setScissor(
        renderViewport.left,
        viewportBottom,
        renderViewport.width,
        renderViewport.height,
      );
      renderer.setScissorTest(true);
      renderer.render(scene, camera);
    }
    animationFrame = window.requestAnimationFrame(render);
  };

  ui.setGridVisible(false);
  ui.setSelectedCell(null);
  ui.setToolMode('navigate');
  ui.setBrushSize(1);
  ui.setUndoAvailable(false);
  ui.setZoneCounts(zoneCounts(zonesSnapshot));
  ui.setBuildingCount(buildingCount(buildingsSnapshot));
  ui.setStatus('Ready');
  render();

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    abortController.abort();
    window.cancelAnimationFrame(animationFrame);
    input.dispose();
    roadPreview.dispose();
    zonePreview.dispose();
    preview.dispose();
    selection.dispose();
    grid.dispose();
    roadPresentation.dispose();
    zonePresentation.dispose();
    buildingPresentation.dispose();
    water.dispose();
    terrain.dispose();
    renderer.dispose();
    delete window.__WEB_THREE_CITY_INTERACTION__;
  };
  window.addEventListener('pagehide', dispose, { once: true });
  return { runAutomaticBuildingPass, dispose };
}
