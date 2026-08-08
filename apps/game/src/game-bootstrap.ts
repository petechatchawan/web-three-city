import {
  buildingCount,
  commitBuildingMutation,
  createEmptyBuildingSnapshot,
  occupiedBuildingCellCount,
  planBuildingBulldoze,
  type BuildingMutationPlan,
} from '@web-three-city/building-core';
import { BuildingPresentation } from '@web-three-city/building-three';
import { OrthographicCameraRig } from '@web-three-city/camera-input';
import {
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  type RciSnapshot,
} from '@web-three-city/rci-core';
import {
  createInitialSimulationSnapshot,
  createSimulationSnapshot,
  type SimulationSnapshot,
} from '@web-three-city/simulation-core';
import {
  commitRoadMutation,
  createEmptyRoadSnapshot,
  occupiedRoadCellCount,
  type RoadMutationPlan,
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
import {
  createCoreWaterPresentationSource,
  WaterPresentation,
  type WaterPresentationBuild,
  type WaterPresentationSource,
} from '@web-three-city/water-three';
import {
  commitZoneMutation,
  createEmptyZoneSnapshot,
  planZoneMutation,
  zoneCounts,
  type ZoneMutationPlan,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';
import {
  createCoreZonePresentationSource,
  ZoneChunkPresentation,
  ZonePreviewPresentation,
} from '@web-three-city/zone-three';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import * as THREE from 'three';
import {
  CommittedWorldStore,
  createCommittedWorldFromDomainState,
  type CommittedDomainState,
  type CommittedWorld,
} from './application/committed-world.js';
import { fingerprintCommittedWorld } from './application/committed-world-fingerprint.js';
import { PresentationCoordinator } from './application/presentation-coordinator.js';
import { reconcileRciForBuildingChange } from './application/rci-building-reconciliation.js';
import { SaveCoordinator } from './application/save-coordinator.js';
import { UndoCoordinator } from './application/undo-coordinator.js';
import {
  DefaultWorldTransactionCoordinator,
  type WorldPresentationPort,
  type WorldPublicationResult,
} from './application/world-transaction-coordinator.js';
import { createBuildingWorldOccupancy } from './building-world-occupancy.js';
import { createGameInput, type GameRenderViewport } from './game-input.js';
import { dispatchGameTransactionState } from './game-tool-events.js';
import type { GameToolMode } from './game-tool-mode.js';
import {
  publishInteractionEvidence,
  type WaterInteractionEvidence,
} from './interaction-evidence.js';
import {
  guardRoadPlanWithBuildings,
  type GameRoadBuildingInvalidReason,
} from './road-building-guard.js';
import { guardRoadPlanWithZones } from './road-zone-guard.js';
import { guardTerraformPlanWithOccupancy } from './terraform-occupancy-guard.js';
import { guardZonePlanWithBuildings, type GameZoneInvalidReason } from './zone-building-guard.js';
import { executeGameWorldTick } from './game-world-tick.js';
import { GameWorldStateStore } from './game-world-state.js';
import { mountRciHud } from './rci-hud.js';
import { renderGameUi, type GameViewportLayout, type QualityLevel } from './game-ui.js';

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

export type CommittedWorldChangeReason = 'publication' | 'load' | 'undo' | 'reset';
export type CommittedWorldSubscriber = (
  world: CommittedWorld,
  reason: CommittedWorldChangeReason,
) => void;

export interface GameRuntime {
  snapshot(): CommittedWorld;
  subscribeCommittedWorld(subscriber: CommittedWorldSubscriber): () => void;
  advanceLogicalTick(input: Readonly<{ automaticGrowth: boolean }>): CommittedWorld;
  resetSimulationForTest(): CommittedWorld;
  savePayload(): ReturnType<SaveCoordinator['savePayload']>;
  runBackgroundGrowthTick(simulation?: SimulationSnapshot): SimulationSnapshot;
  runSimulationOnlyTick(simulation?: SimulationSnapshot): SimulationSnapshot;
  dispose(): void;
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

function statusForBuildingBulldozePlan(plan: BuildingMutationPlan): string {
  if (plan.valid) return 'Building bulldozed';
  if (plan.invalidReason === 'building:not-found') return 'No building selected';
  return 'Building bulldoze rejected';
}

export function bootstrapGame(root: HTMLElement): GameRuntime {
  const ui = renderGameUi(root);
  const generated = generateCoastalTerrain({ seed: CURATED_SEED, config: WORLD_CONFIG });
  if (!generated.ok) throw new Error(`game:generation-failed:${generated.error.code}`);
  const initialWaterDerivationStart = performance.now();
  const initialSimulation = createInitialSimulationSnapshot();
  const initialWorld = createCommittedWorldFromDomainState({
    revision: 0,
    terrain: generated.value,
    roads: createEmptyRoadSnapshot(WORLD_CONFIG),
    zones: createEmptyZoneSnapshot(WORLD_CONFIG),
    buildings: createEmptyBuildingSnapshot(WORLD_CONFIG),
    simulation: initialSimulation,
    rci: createInitialRciSnapshot({ absoluteTick: initialSimulation.absoluteTick }),
  });
  const capability = detectWebGL2(ui.canvas);
  if (!capability.supported) {
    ui.setStatus('WebGL2 unavailable');
    const unavailableWorld = new CommittedWorldStore(initialWorld);
    const subscribers = new Set<CommittedWorldSubscriber>();
    return {
      snapshot: () => unavailableWorld.snapshot(),
      subscribeCommittedWorld(subscriber: CommittedWorldSubscriber): () => void {
        subscribers.add(subscriber);
        return () => subscribers.delete(subscriber);
      },
      advanceLogicalTick: () => unavailableWorld.snapshot(),
      resetSimulationForTest: () => unavailableWorld.snapshot(),
      savePayload(): never {
        throw new Error('game:runtime-unavailable');
      },
      runBackgroundGrowthTick: () => unavailableWorld.snapshot().simulation,
      runSimulationOnlyTick: () => unavailableWorld.snapshot().simulation,
      dispose(): void {
        subscribers.clear();
      },
    };
  }

  let snapshot = initialWorld.terrain;
  let waterSnapshot = initialWorld.water;
  let roadsSnapshot = initialWorld.roads;
  let zonesSnapshot = initialWorld.zones;
  let buildingsSnapshot = initialWorld.buildings;
  const rciRegistries = createFoundationRciRegistries();
  let simulationSnapshot = initialWorld.simulation;
  let rciSnapshot: RciSnapshot = initialWorld.rci;
  let roadEnvironment = initialWorld.environments.road;
  let zoneEnvironment = initialWorld.environments.zone;
  let buildingEnvironment = initialWorld.environments.building;
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
  const rciHud = mountRciHud(ui.panel);
  rciHud.update(rciSnapshot, rciRegistries, simulationSnapshot.absoluteTick);

  const grid = new TerrainGridPresentation(scene, WORLD_CONFIG);
  grid.setVisible(false);
  grid.load(snapshot);
  const selection = new SelectedCellPresentation(scene, WORLD_CONFIG);
  const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);

  const setSelection = (cell: CellCoord | null): void => {
    selectedCell = cell === null ? null : { ...cell };
    ui.setSelectedCell(selectedCell);
    if (selectedCell === null) selection.clear();
    else selection.setSelection(snapshot, selectedCell);
  };

  const inputRef: { current: ReturnType<typeof createGameInput> | null } = { current: null };

  const committedWorldStore = new CommittedWorldStore(initialWorld);
  const committedWorldSubscribers = new Set<CommittedWorldSubscriber>();

  const notifyCommittedWorld = (
    world: CommittedWorld,
    reason: CommittedWorldChangeReason,
  ): void => {
    for (const subscriber of [...committedWorldSubscribers]) {
      try {
        subscriber(world, reason);
      } catch {
        // Subscriber failures are post-publication presentation failures and never roll authority back.
      }
    }
  };

  const adoptCommittedWorld = (
    world: CommittedWorld,
    reason: CommittedWorldChangeReason = 'publication',
  ): void => {
    snapshot = world.terrain;
    waterSnapshot = world.water;
    roadsSnapshot = world.roads;
    roadEnvironment = world.environments.road;
    zonesSnapshot = world.zones;
    zoneEnvironment = world.environments.zone;
    buildingsSnapshot = world.buildings;
    buildingEnvironment = world.environments.building;
    simulationSnapshot = world.simulation;
    rciSnapshot = world.rci;
    rciHud.update(rciSnapshot, rciRegistries, simulationSnapshot.absoluteTick);
    ui.setZoneCounts(zoneCounts(zonesSnapshot));
    ui.setBuildingCount(buildingCount(buildingsSnapshot));
    notifyCommittedWorld(world, reason);
  };

  const presentationCoordinator = new PresentationCoordinator({
    setReplacingWorld: (value) => {
      replacingWorld = value;
    },
    loadTerrain: (world) => terrain.load(world.terrain),
    loadWater: (world) => {
      const presentationStart = performance.now();
      water.load(world.terrain, world.water);
      waterPresentationDurationMs = performance.now() - presentationStart;
      waterBuildMetrics = stagedWaterBuildMetrics;
    },
    loadGrid: (world) => grid.load(world.terrain),
    loadRoads: (world) => roadPresentation.loadAll(world.roads, world.environments.road),
    loadZones: (world) => {
      zoneSurfaceSnapshot = world.terrain;
      zonePresentation.loadAll(world.zones);
    },
    loadBuildings: (world) => buildingPresentation.load(world.buildings),
    rebuildSelection: (world) => rebuildSelection(selection, world.terrain, selectedCell),
    refreshTerrainObjects: () => inputRef.current?.refreshTerrainObjects(),
  });
  const transactionCoordinator = new DefaultWorldTransactionCoordinator({
    worldStore: committedWorldStore,
    presentation: presentationCoordinator.completeWorld,
  });
  const saveCoordinator = new SaveCoordinator({
    storage: Object.freeze({
      read: (key: string) => localStorage.getItem(key),
      write: (key: string, value: string) => localStorage.setItem(key, value),
    }),
    worldStore: committedWorldStore,
    transactionCoordinator,
  });
  const undoCoordinator = new UndoCoordinator({ transactionCoordinator });

  type DomainOverrides = Partial<Omit<CommittedDomainState, 'revision'>>;
  const publishCommittedDomain = (
    overrides: DomainOverrides,
    presentation?: WorldPresentationPort,
  ): Readonly<{ before: CommittedWorld; result: WorldPublicationResult }> => {
    const before = transactionCoordinator.snapshot();
    const nextWorld = createCommittedWorldFromDomainState({
      revision: before.revision + 1,
      terrain: overrides.terrain ?? before.terrain,
      roads: overrides.roads ?? before.roads,
      zones: overrides.zones ?? before.zones,
      buildings: overrides.buildings ?? before.buildings,
      simulation: overrides.simulation ?? before.simulation,
      rci: overrides.rci ?? before.rci,
    });
    const result = transactionCoordinator.publish({
      baseRevision: before.revision,
      baseFingerprint: fingerprintCommittedWorld(before),
      nextWorld,
      nextFingerprint: fingerprintCommittedWorld(nextWorld),
      ...(presentation === undefined ? {} : { presentation }),
    });
    if (result.status === 'committed') adoptCommittedWorld(result.world);
    return Object.freeze({ before, result });
  };

  const applyTerraformPlan = (plan: TerraformPlan): void => {
    const current = transactionCoordinator.snapshot();
    const candidate = guardTerraformPlanWithOccupancy(
      plan,
      current.roads,
      current.zones,
      current.buildings,
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
      ui.setUndoAvailable(undoCoordinator.available);
      return;
    }

    try {
      const committed = commitTerraformPlan(current.terrain, plan, WORLD_CONFIG);
      const derivationStart = performance.now();
      const publication = publishCommittedDomain({ terrain: committed.snapshot });
      if (publication.result.status === 'committed') {
        undoCoordinator.record(publication.before, 'terraform');
        terraformCommitCount += 1;
        terraformWaterRebuildCount += 1;
        waterDerivationDurationMs = performance.now() - derivationStart;
        ui.setStatus('Terraform applied');
      } else {
        ui.setStatus('Terraform rejected');
      }
    } catch {
      ui.setStatus('Terraform rejected');
    }
    ui.setUndoAvailable(undoCoordinator.available);
  };

  const applyRoadPlan = (
    plan: RoadMutationPlan,
    routedReason: GameRoadBuildingInvalidReason | null = null,
  ): void => {
    const current = transactionCoordinator.snapshot();
    const zoneCandidate = guardRoadPlanWithZones(
      plan,
      current.roads,
      current.zones,
      current.terrain,
      current.water,
      createBuildingWorldOccupancy(current.buildings),
      WORLD_CONFIG,
    );
    const candidate = guardRoadPlanWithBuildings(
      zoneCandidate,
      current.roads,
      current.buildings,
      current.terrain,
      current.water,
      current.zones,
      WORLD_CONFIG,
    );
    const reason = routedReason ?? candidate.invalidReason;
    if (!candidate.valid) {
      ui.setStatus(statusForRoadPlan(candidate.previewPlan, reason));
      ui.setUndoAvailable(undoCoordinator.available);
      return;
    }

    try {
      const committed = commitRoadMutation(
        current.roads,
        candidate.corePlan,
        current.environments.road,
        WORLD_CONFIG,
      );
      const publication = publishCommittedDomain(
        { roads: committed.snapshot },
        presentationCoordinator.incremental((world) =>
          roadPresentation.rebuildDirty(
            world.roads,
            world.environments.road,
            committed.receipt.dirtyChunks,
          ),
        ),
      );
      if (publication.result.status === 'committed') {
        undoCoordinator.record(publication.before, 'road');
        roadLastDirtyChunkCount = committed.receipt.dirtyChunks.length;
        roadChunkRebuildCount += committed.receipt.dirtyChunks.length;
        if (committed.receipt.addedCellCount > 0) roadCommitCount += 1;
        if (committed.receipt.removedCellCount > 0) roadBulldozeCount += 1;
        ui.setStatus(statusForRoadPlan(candidate.corePlan));
      } else {
        ui.setStatus('Road update failed');
      }
    } catch {
      ui.setStatus('Road update failed');
    }
    ui.setUndoAvailable(undoCoordinator.available);
  };

  const applyZonePlan = (plan: ZoneMutationPlan): void => {
    const current = transactionCoordinator.snapshot();
    const revalidatedPlan = planZoneMutation(
      current.zones,
      { operation: plan.operation, definitionId: plan.definitionId, cells: plan.requestedCells },
      current.environments.zone,
      WORLD_CONFIG,
    );
    const candidate = guardZonePlanWithBuildings(revalidatedPlan, current.buildings);
    const reason = candidate.invalidReason;
    zoneInvalidReason = reason;
    if (!candidate.valid || reason !== null) {
      ui.setStatus(statusForZonePlan(candidate.previewPlan, reason));
      ui.setUndoAvailable(undoCoordinator.available);
      return;
    }

    try {
      const committed = commitZoneMutation(
        current.zones,
        candidate.corePlan,
        current.environments.zone,
        WORLD_CONFIG,
      );
      const publication = publishCommittedDomain(
        { zones: committed.snapshot },
        presentationCoordinator.incremental((world) =>
          zonePresentation.rebuildDirty(world.zones, committed.receipt.dirtyChunks),
        ),
      );
      if (publication.result.status === 'committed') {
        undoCoordinator.record(publication.before, 'zone');
        zoneLastDirtyChunkCount = committed.receipt.dirtyChunks.length;
        zoneChunkRebuildCount += committed.receipt.dirtyChunks.length;
        if (candidate.corePlan.operation === 'paint') zoneCommitCount += 1;
        else zoneRemoveCount += 1;
        zoneInvalidReason = null;
        ui.setStatus(statusForZonePlan(candidate.corePlan));
      } else {
        ui.setStatus('Zone update failed');
      }
    } catch {
      ui.setStatus('Zone update failed');
    }
    ui.setUndoAvailable(undoCoordinator.available);
  };

  const commitBuildingBulldozePlan = (plan: BuildingMutationPlan): void => {
    if (plan.operation !== 'bulldoze') {
      throw new Error('game:interactive-building-operation-must-be-bulldoze');
    }
    buildingInvalidReason = plan.invalidReason;
    if (!plan.valid) {
      ui.setStatus(statusForBuildingBulldozePlan(plan));
      ui.setUndoAvailable(undoCoordinator.available);
      return;
    }
    const current = transactionCoordinator.snapshot();
    dispatchGameTransactionState(ui.canvas, 'committing', 'building');
    try {
      const committed = commitBuildingMutation(
        current.buildings,
        plan,
        current.environments.building,
        WORLD_CONFIG,
      );
      const reconciledRci = reconcileRciForBuildingChange({
        rci: current.rci,
        buildingsBefore: current.buildings,
        buildingsAfter: committed.snapshot,
        registries: rciRegistries,
        evaluationTick: current.simulation.absoluteTick,
      });
      const publication = publishCommittedDomain(
        { buildings: committed.snapshot, rci: reconciledRci },
        presentationCoordinator.incremental((world) => buildingPresentation.load(world.buildings)),
      );
      if (publication.result.status === 'committed') {
        undoCoordinator.record(publication.before, 'building');
        buildingBulldozeCount += 1;
        buildingInvalidReason = null;
        ui.setStatus(statusForBuildingBulldozePlan(plan));
      } else {
        ui.setStatus('Building update failed');
      }
    } catch {
      ui.setStatus('Building update failed');
    }
    ui.setUndoAvailable(undoCoordinator.available);
  };

  const applyBuildingBulldozeRequest = (cell: CellCoord): void => {
    commitBuildingBulldozePlan(
      planBuildingBulldoze(buildingsSnapshot, cell, buildingEnvironment, WORLD_CONFIG),
    );
  };

  const runBackgroundGrowthTick = (): SimulationSnapshot => {
    const current = transactionCoordinator.snapshot();
    const tickStore = new GameWorldStateStore({
      revision: 0,
      simulation: current.simulation,
      buildings: current.buildings,
      rci: current.rci,
    });
    try {
      const result = executeGameWorldTick({
        store: tickStore,
        environment: current.environments.building,
        config: WORLD_CONFIG,
        registries: rciRegistries,
        reservedCells: inputRef.current?.getBackgroundGrowthReservations() ?? Object.freeze([]),
      });
      const buildingsChanged = result.state.buildings.revision !== current.buildings.revision;
      const publication = publishCommittedDomain(
        {
          simulation: result.state.simulation,
          buildings: result.state.buildings,
          rci: result.state.rci,
        },
        buildingsChanged
          ? presentationCoordinator.incremental((world) =>
              buildingPresentation.load(world.buildings),
            )
          : presentationCoordinator.noOp,
      );
      if (publication.result.status !== 'committed') return current.simulation;
      if (buildingsChanged) buildingCommitCount += 1;
      return publication.result.world.simulation;
    } catch {
      return current.simulation;
    }
  };

  const runSimulationOnlyTick = (): SimulationSnapshot => {
    const current = transactionCoordinator.snapshot();
    const next = createSimulationSnapshot({
      revision: current.simulation.revision + 1,
      absoluteTick: current.simulation.absoluteTick + 1,
      growthSequence: current.simulation.growthSequence,
    });
    const publication = publishCommittedDomain({ simulation: next }, presentationCoordinator.noOp);
    return publication.result.status === 'committed'
      ? publication.result.world.simulation
      : transactionCoordinator.snapshot().simulation;
  };

  const advanceLogicalTick = (input: Readonly<{ automaticGrowth: boolean }>): CommittedWorld => {
    if (input.automaticGrowth) runBackgroundGrowthTick();
    else runSimulationOnlyTick();
    return transactionCoordinator.snapshot();
  };

  const resetSimulationForTest = (): CommittedWorld => {
    const publication = publishCommittedDomain(
      { simulation: createInitialSimulationSnapshot() },
      presentationCoordinator.noOp,
    );
    if (publication.result.status === 'committed') {
      undoCoordinator.clear();
      return publication.result.world;
    }
    return transactionCoordinator.snapshot();
  };

  const subscribeCommittedWorld = (subscriber: CommittedWorldSubscriber): (() => void) => {
    committedWorldSubscribers.add(subscriber);
    return () => committedWorldSubscribers.delete(subscriber);
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
    onBuildingBulldoze: applyBuildingBulldozeRequest,
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
      saveCoordinator.save();
      ui.setStatus('Saved');
    },
    listenerOptions,
  );
  ui.loadButton.addEventListener(
    'click',
    () => {
      input.clearActiveSession();
      const result = saveCoordinator.load();
      if (result.status === 'rejected') {
        ui.setStatus(result.reason === 'world:no-save' ? 'No save' : 'Invalid save');
        return;
      }
      adoptCommittedWorld(result.world, 'load');
      undoCoordinator.clear();
      ui.setUndoAvailable(false);
      ui.setStatus('Loaded');
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
      const kind = undoCoordinator.kind;
      const before = transactionCoordinator.snapshot();
      const result = undoCoordinator.undo();
      if (result === null || result.status === 'rejected') {
        ui.setUndoAvailable(undoCoordinator.available);
        return;
      }
      adoptCommittedWorld(result.world, 'undo');
      if (kind === 'terraform') {
        terraformUndoCount += 1;
        terraformWaterRebuildCount += 1;
        ui.setStatus('Terraform undone');
      } else if (kind === 'road') {
        const dirtyChunks = roadDirtyChunksBetween(before.roads, result.world.roads);
        roadUndoCount += 1;
        roadLastDirtyChunkCount = dirtyChunks.length;
        roadChunkRebuildCount += dirtyChunks.length;
        ui.setStatus('Road undone');
      } else if (kind === 'zone') {
        const dirtyChunks = zoneDirtyChunksBetween(before.zones, result.world.zones);
        zoneUndoCount += 1;
        zoneLastDirtyChunkCount = dirtyChunks.length;
        zoneChunkRebuildCount += dirtyChunks.length;
        zoneInvalidReason = null;
        ui.setStatus('Zone undone');
      } else if (kind === 'building') {
        buildingUndoCount += 1;
        buildingInvalidReason = null;
        ui.setStatus('Building undone');
      }
      ui.setUndoAvailable(undoCoordinator.available);
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
      presentationCoordinator.rebuildCommittedWorld(transactionCoordinator.snapshot());
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
        undoAvailable: undoCoordinator.available,
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
        undoKind: undoCoordinator.kind,
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
        undoKind: undoCoordinator.kind,
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
        undoKind: undoCoordinator.kind,
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
    rciHud.dispose();
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
    committedWorldSubscribers.clear();
    delete window.__WEB_THREE_CITY_INTERACTION__;
  };
  window.addEventListener('pagehide', dispose, { once: true });
  return {
    snapshot: () => transactionCoordinator.snapshot(),
    subscribeCommittedWorld,
    advanceLogicalTick,
    resetSimulationForTest,
    savePayload: () => saveCoordinator.savePayload(),
    runBackgroundGrowthTick,
    runSimulationOnlyTick,
    dispose,
  };
}
