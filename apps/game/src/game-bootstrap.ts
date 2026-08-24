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
  createInitialEconomySnapshot,
  FOUNDATION_ECONOMY_RULES,
} from '@web-three-city/economy-core';
import { createFoundationRciRegistries, createInitialRciSnapshot } from '@web-three-city/rci-core';
import {
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  type TrafficGraph,
} from '@web-three-city/traffic-core';
import {
  deriveMacroHourIndex,
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
import { executeEconomyTaxPolicyCommand } from './application/economy-tax-policy-command.js';
import { PresentationCoordinator } from './application/presentation-coordinator.js';
import { reconcileRciForBuildingChange } from './application/rci-building-reconciliation.js';
import { staticPresentationNeedsRebuild } from './application/static-presentation-refresh.js';
import { SaveCoordinator } from './application/save-coordinator.js';
import {
  applyPaidActionCost,
  quoteBuildingBulldozeCost,
  quoteRoadMutationCost,
  quoteTerraformCost,
} from './application/economy-action-cost.js';
import { UndoCoordinator } from './application/undo-coordinator.js';
import {
  DefaultWorldTransactionCoordinator,
  type WorldPresentationPort,
  type WorldPublicationResult,
} from './application/world-transaction-coordinator.js';
import { createBuildingWorldOccupancy } from './building-world-occupancy.js';
import { createGameInput, type GameRenderViewport } from './game-input.js';
import { dispatchGameTransactionState } from './game-tool-events.js';
import { createTrafficGraphCache } from './traffic-graph-cache.js';
import {
  createRoadTrafficSourceProjectionProvider,
  type RoadTrafficSourceProjectionProvider,
} from './road-traffic-source-provider.js';
import type { GameToolMode } from './game-tool-mode.js';
import type { GameTerraformInvalidReason } from './terraform-occupancy-guard.js';
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
import { createTemporalPublicationController } from './temporal-publication-controller.js';
import { type EconomyPolicyUiResult, type EconomyTaxPolicy } from './economy-budget-hud.js';
import type { GameBootstrapHost, GameViewportLayout, QualityLevel } from './game-ui.js';

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
export type WorldSelectionSubscriber = (cell: CellCoord) => void;
export type InformationViewKey = 'grid' | 'zoning' | null;

export interface GameRuntime {
  snapshot(): CommittedWorld;
  /** Read-only test seam; callers must not retain or mutate the internal world. */
  snapshotForTest(): CommittedWorld;
  subscribeCommittedWorld(subscriber: CommittedWorldSubscriber): () => void;
  subscribeWorldSelection(subscriber: WorldSelectionSubscriber): () => void;
  advanceLogicalTick(input: Readonly<{ automaticGrowth: boolean }>): CommittedWorld;
  advanceGameMinute(input?: Readonly<{ automaticGrowth?: boolean }>): CommittedWorld;
  advanceTransportQuantum(): CommittedWorld;
  advanceTemporalMinute(input?: Readonly<{ automaticGrowth?: boolean }>): CommittedWorld;
  setPresentationSuppressed(suppressed: boolean): void;
  rebuildPresentationForTest(): CommittedWorld;
  resetSimulationForTest(): CommittedWorld;
  savePayload(): ReturnType<SaveCoordinator['savePayload']>;
  runBackgroundGrowthTick(simulation?: SimulationSnapshot): SimulationSnapshot;
  runSimulationOnlyTick(simulation?: SimulationSnapshot): SimulationSnapshot;
  selectTool(mode: GameToolMode): void;
  setTerraformBrush(size: TerraformBrushSize): void;
  submitTaxPolicy(policy: EconomyTaxPolicy): EconomyPolicyUiResult;
  setInformationView(key: InformationViewKey): void;
  saveWorld(): void;
  loadWorld(): void;
  rotateLeft(): void;
  rotateRight(): void;
  resetCamera(): void;
  toggleGrid(): void;
  setQuality(quality: QualityLevel): void;
  undo(): void;
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

const trafficGraphCache = createTrafficGraphCache<TrafficGraph>();

function combinedTrafficGraphForWorld(
  world: CommittedWorld,
  roadTrafficSourceProvider: RoadTrafficSourceProjectionProvider,
): TrafficGraph {
  return trafficGraphCache.get(world.roads, world.environments.building, world.buildings, () => {
    const roads = roadTrafficSourceProvider.get(world.roads, world.environments.building);
    const buildingRevision = world.buildings.revision;
    const vehicle = Object.freeze({
      ...deriveVehicleTrafficGraph(roads),
      sourceBuildingRevision: buildingRevision,
    });
    const pedestrian = Object.freeze({
      ...derivePedestrianTrafficGraph(roads),
      sourceBuildingRevision: buildingRevision,
    });
    const nodes = new Map(
      [...vehicle.nodes, ...pedestrian.nodes].map((node) => [node.nodeId, node]),
    );
    return Object.freeze({
      sourceRoadRevision: world.roads.revision,
      sourceBuildingRevision: buildingRevision,
      nodes: Object.freeze(
        [...nodes.values()].sort((first, second) =>
          first.nodeId < second.nodeId ? -1 : first.nodeId > second.nodeId ? 1 : 0,
        ),
      ),
      edges: Object.freeze(
        [...vehicle.edges, ...pedestrian.edges].sort((first, second) =>
          first.edgeId < second.edgeId ? -1 : first.edgeId > second.edgeId ? 1 : 0,
        ),
      ),
    });
  });
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

function statusForTerraformReason(
  reason: GameTerraformInvalidReason | 'terraform:no-change' | null,
): string {
  if (reason === null) return 'Terraform rejected';
  if (reason === 'terraform:building-occupied') return 'Terraform blocked by building';
  if (reason === 'terraform:zone-occupied') return 'Terraform blocked by zone';
  if (reason === 'terraform:road-occupied') return 'Terraform blocked by road';
  if (reason === 'terraform:no-change') return 'Terraform unchanged';
  return 'Terraform rejected';
}

export interface GameBootstrapOptions {
  readonly roadTrafficSourceProvider?: RoadTrafficSourceProjectionProvider;
}

export function bootstrapGame(
  host: GameBootstrapHost,
  options: GameBootstrapOptions = {},
): GameRuntime {
  const roadTrafficSourceProvider =
    options.roadTrafficSourceProvider ?? createRoadTrafficSourceProjectionProvider();
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
    rci: createInitialRciSnapshot({
      absoluteTick: deriveMacroHourIndex(initialSimulation.absoluteGameMinute),
    }),
    economy: createInitialEconomySnapshot(
      {
        year: 1,
        month: 1,
        latestDailySettlementTick: deriveMacroHourIndex(initialSimulation.absoluteGameMinute),
      },
      FOUNDATION_ECONOMY_RULES,
    ),
  });
  const capability = detectWebGL2(host.canvas);
  if (!capability.supported) {
    host.setStatus('WebGL2 unavailable');
    const unavailableWorld = new CommittedWorldStore(initialWorld);
    const subscribers = new Set<CommittedWorldSubscriber>();
    const selectionSubscribers = new Set<WorldSelectionSubscriber>();
    return {
      snapshot: () => unavailableWorld.snapshot(),
      snapshotForTest: () => unavailableWorld.snapshot(),
      subscribeCommittedWorld(subscriber: CommittedWorldSubscriber): () => void {
        subscribers.add(subscriber);
        return () => subscribers.delete(subscriber);
      },
      subscribeWorldSelection(subscriber: WorldSelectionSubscriber): () => void {
        selectionSubscribers.add(subscriber);
        return () => selectionSubscribers.delete(subscriber);
      },
      advanceLogicalTick: () => unavailableWorld.snapshot(),
      advanceGameMinute: () => unavailableWorld.snapshot(),
      advanceTransportQuantum: () => unavailableWorld.snapshot(),
      advanceTemporalMinute: () => unavailableWorld.snapshot(),
      setPresentationSuppressed: () => undefined,
      rebuildPresentationForTest: () => unavailableWorld.snapshot(),
      resetSimulationForTest: () => unavailableWorld.snapshot(),
      savePayload(): never {
        throw new Error('game:runtime-unavailable');
      },
      runBackgroundGrowthTick: () => unavailableWorld.snapshot().simulation,
      runSimulationOnlyTick: () => unavailableWorld.snapshot().simulation,
      selectTool: () => undefined,
      setTerraformBrush: () => undefined,
      submitTaxPolicy: () =>
        Object.freeze({ status: 'rejected', reason: 'game:runtime-unavailable' }),
      setInformationView: () => undefined,
      saveWorld: () => undefined,
      loadWorld: () => undefined,
      rotateLeft: () => undefined,
      rotateRight: () => undefined,
      resetCamera: () => undefined,
      toggleGrid: () => undefined,
      setQuality: () => undefined,
      undo: () => undefined,
      dispose(): void {
        subscribers.clear();
        selectionSubscribers.clear();
      },
    };
  }

  let snapshot = initialWorld.terrain;
  let waterSnapshot = initialWorld.water;
  let roadsSnapshot = initialWorld.roads;
  let zonesSnapshot = initialWorld.zones;
  let buildingsSnapshot = initialWorld.buildings;
  const rciRegistries = createFoundationRciRegistries();
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
    canvas: host.canvas,
    context: capability.context,
    antialias: true,
    alpha: true,
  });
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0, 0);

  const scene = new THREE.Scene();
  scene.background = null;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4f5b45, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-60, 100, -30);
  scene.add(sun);

  const camera = new THREE.OrthographicCamera();
  const framingMarginRatio = 0.08;
  const cameraRig = new OrthographicCameraRig(camera, WORLD_CONFIG, {
    framingMarginRatio,
    maximumOrthographicSize: 240,
  });
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

  let lastPresentedStaticWorld = initialWorld;

  const grid = new TerrainGridPresentation(scene, WORLD_CONFIG);
  grid.setVisible(false);
  grid.load(snapshot);
  const selection = new SelectedCellPresentation(scene, WORLD_CONFIG);
  const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);
  const worldSelectionSubscribers = new Set<WorldSelectionSubscriber>();

  const setSelection = (cell: CellCoord | null): void => {
    selectedCell = cell === null ? null : { ...cell };
    if (selectedCell === null) selection.clear();
    else {
      selection.setSelection(snapshot, selectedCell);
      for (const subscriber of [...worldSelectionSubscribers]) subscriber(selectedCell);
    }
  };

  const inputRef: { current: ReturnType<typeof createGameInput> | null } = { current: null };

  let presentationSuppressedForTest = false;

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
    if (!presentationSuppressedForTest) lastPresentedStaticWorld = world;
    notifyCommittedWorld(world, reason);
  };

  const presentationCoordinator = new PresentationCoordinator({
    beforeSynchronize: () => {
      replacingWorld = true;
    },
    steps: [
      (world) => terrain.load(world.terrain),
      (world) => {
        const presentationStart = performance.now();
        water.load(world.terrain, world.water);
        waterPresentationDurationMs = performance.now() - presentationStart;
        waterBuildMetrics = stagedWaterBuildMetrics;
      },
      (world) => grid.load(world.terrain),
      (world) => roadPresentation.loadAll(world.roads, world.environments.road),
      (world) => {
        zoneSurfaceSnapshot = world.terrain;
        zonePresentation.loadAll(world.zones);
      },
      (world) => buildingPresentation.load(world.buildings),
      (world) => rebuildSelection(selection, world.terrain, selectedCell),
      () => inputRef.current?.refreshTerrainObjects(),
    ],
    afterSynchronize: () => {
      replacingWorld = false;
    },
  });
  const completeWorldPresentation = presentationCoordinator.completePort();
  const incrementalPresentation = (
    synchronize: (world: CommittedWorld) => void,
  ): WorldPresentationPort => presentationCoordinator.incrementalPort(synchronize);
  const noOpPresentation = presentationCoordinator.noOpPort();
  const transactionCoordinator = new DefaultWorldTransactionCoordinator({
    worldStore: committedWorldStore,
    presentation: completeWorldPresentation,
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
  const temporalPublication = createTemporalPublicationController({
    coordinator: transactionCoordinator,
    registries: rciRegistries,
    graphForWorld: (world) => combinedTrafficGraphForWorld(world, roadTrafficSourceProvider),
    reservedCells: () => inputRef.current?.getBackgroundGrowthReservations() ?? Object.freeze([]),
    intermediatePresentation: noOpPresentation,
    finalDynamicPresentation: noOpPresentation,
    completePresentation: completeWorldPresentation,
    presentationSuppressed: () => presentationSuppressedForTest,
    adoptCommittedWorld,
    roadTrafficSourceProvider,
  });

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
      economy: overrides.economy ?? before.economy,
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

  const submitTaxPolicy = (policy: EconomyTaxPolicy): EconomyPolicyUiResult => {
    const result = executeEconomyTaxPolicyCommand(transactionCoordinator, policy);
    if (result.status === 'accepted') {
      adoptCommittedWorld(transactionCoordinator.snapshot());
      host.setStatus('Tax policy updated');
      return Object.freeze({ status: 'accepted' as const });
    }
    host.setStatus('Tax policy rejected');
    return Object.freeze({ status: 'rejected' as const, reason: result.reason });
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
      host.setStatus(statusForTerraformReason(candidate.invalidReason));
      host.setUndoAvailable(undoCoordinator.available);
      return;
    }

    try {
      const quote = quoteTerraformCost(plan, FOUNDATION_ECONOMY_RULES);
      if (!quote.ok) {
        host.setStatus('Terraform rejected');
        return;
      }
      const payment = applyPaidActionCost(current.economy, quote, FOUNDATION_ECONOMY_RULES);
      if (!payment.ok) {
        host.setStatus(
          payment.reason === 'insufficient-funds' ? 'Insufficient funds' : 'Terraform rejected',
        );
        return;
      }
      const committed = commitTerraformPlan(current.terrain, plan, WORLD_CONFIG);
      const derivationStart = performance.now();
      const publication = publishCommittedDomain({
        terrain: committed.snapshot,
        economy: payment.snapshot,
      });
      if (publication.result.status === 'committed') {
        undoCoordinator.record(publication.before, 'terraform', payment.receipt);
        terraformCommitCount += 1;
        terraformWaterRebuildCount += 1;
        waterDerivationDurationMs = performance.now() - derivationStart;
        host.setStatus('Terraform applied');
      } else {
        host.setStatus('Terraform rejected');
      }
    } catch {
      host.setStatus('Terraform rejected');
    }
    host.setUndoAvailable(undoCoordinator.available);
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
      host.setStatus(statusForRoadPlan(candidate.previewPlan, reason));
      host.setUndoAvailable(undoCoordinator.available);
      return;
    }

    try {
      const committed = commitRoadMutation(
        current.roads,
        candidate.corePlan,
        current.environments.road,
        WORLD_CONFIG,
      );
      const quote = quoteRoadMutationCost(
        {
          valid: candidate.valid,
          addedCellCount: committed.receipt.addedCellCount,
          removedCellCount: committed.receipt.removedCellCount,
        },
        FOUNDATION_ECONOMY_RULES,
      );
      if (!quote.ok) {
        host.setStatus('Road update failed');
        return;
      }
      const payment = applyPaidActionCost(current.economy, quote, FOUNDATION_ECONOMY_RULES);
      if (!payment.ok) {
        host.setStatus(
          payment.reason === 'insufficient-funds' ? 'Insufficient funds' : 'Road update failed',
        );
        return;
      }
      const publication = publishCommittedDomain(
        { roads: committed.snapshot, economy: payment.snapshot },
        incrementalPresentation((world) =>
          roadPresentation.rebuildDirty(
            world.roads,
            world.environments.road,
            committed.receipt.dirtyChunks,
          ),
        ),
      );
      if (publication.result.status === 'committed') {
        undoCoordinator.record(publication.before, 'road', payment.receipt);
        roadLastDirtyChunkCount = committed.receipt.dirtyChunks.length;
        roadChunkRebuildCount += committed.receipt.dirtyChunks.length;
        if (committed.receipt.addedCellCount > 0) roadCommitCount += 1;
        if (committed.receipt.removedCellCount > 0) roadBulldozeCount += 1;
        host.setStatus(statusForRoadPlan(candidate.corePlan));
      } else {
        host.setStatus('Road update failed');
      }
    } catch {
      host.setStatus('Road update failed');
    }
    host.setUndoAvailable(undoCoordinator.available);
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
      host.setStatus(statusForZonePlan(candidate.previewPlan, reason));
      host.setUndoAvailable(undoCoordinator.available);
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
        incrementalPresentation((world) =>
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
        host.setStatus(statusForZonePlan(candidate.corePlan));
      } else {
        host.setStatus('Zone update failed');
      }
    } catch {
      host.setStatus('Zone update failed');
    }
    host.setUndoAvailable(undoCoordinator.available);
  };

  const commitBuildingBulldozePlan = (plan: BuildingMutationPlan): void => {
    if (plan.operation !== 'bulldoze') {
      throw new Error('game:interactive-building-operation-must-be-bulldoze');
    }
    buildingInvalidReason = plan.invalidReason;
    if (!plan.valid) {
      host.setStatus(statusForBuildingBulldozePlan(plan));
      host.setUndoAvailable(undoCoordinator.available);
      return;
    }
    const current = transactionCoordinator.snapshot();
    dispatchGameTransactionState(host.canvas, 'committing', 'building');
    try {
      const committed = commitBuildingMutation(
        current.buildings,
        plan,
        current.environments.building,
        WORLD_CONFIG,
      );
      const quote = quoteBuildingBulldozeCost(
        { valid: plan.valid, removedCellCount: committed.receipt.removedCellCount },
        FOUNDATION_ECONOMY_RULES,
      );
      if (!quote.ok) {
        host.setStatus('Building update failed');
        return;
      }
      const payment = applyPaidActionCost(current.economy, quote, FOUNDATION_ECONOMY_RULES);
      if (!payment.ok) {
        host.setStatus(
          payment.reason === 'insufficient-funds' ? 'Insufficient funds' : 'Building update failed',
        );
        return;
      }
      const reconciledRci = reconcileRciForBuildingChange({
        rci: current.rci,
        buildingsBefore: current.buildings,
        buildingsAfter: committed.snapshot,
        registries: rciRegistries,
        evaluationTick: deriveMacroHourIndex(current.simulation.absoluteGameMinute),
      });
      const publication = publishCommittedDomain(
        { buildings: committed.snapshot, rci: reconciledRci, economy: payment.snapshot },
        incrementalPresentation((world) => buildingPresentation.load(world.buildings)),
      );
      if (publication.result.status === 'committed') {
        undoCoordinator.record(publication.before, 'building', payment.receipt);
        buildingBulldozeCount += 1;
        buildingInvalidReason = null;
        host.setStatus(statusForBuildingBulldozePlan(plan));
      } else {
        host.setStatus('Building update failed');
      }
    } catch {
      host.setStatus('Building update failed');
    }
    host.setUndoAvailable(undoCoordinator.available);
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
      roads: current.roads,
      economy: current.economy,
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
          economy: result.state.economy,
        },
        buildingsChanged
          ? incrementalPresentation((world) => buildingPresentation.load(world.buildings))
          : noOpPresentation,
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
      absoluteGameMinute: current.simulation.absoluteGameMinute + 1,
      growthSequence: current.simulation.growthSequence,
    });
    const publication = publishCommittedDomain({ simulation: next }, noOpPresentation);
    return publication.result.status === 'committed'
      ? publication.result.world.simulation
      : transactionCoordinator.snapshot().simulation;
  };

  const advanceLogicalTick = (input: Readonly<{ automaticGrowth: boolean }>): CommittedWorld => {
    if (input.automaticGrowth) runBackgroundGrowthTick();
    else runSimulationOnlyTick();
    return transactionCoordinator.snapshot();
  };

  const advanceGameMinute = (input: Readonly<{ automaticGrowth?: boolean }> = {}): CommittedWorld =>
    temporalPublication.advanceGameMinute(input);

  const advanceTransportQuantum = (): CommittedWorld =>
    temporalPublication.advanceTransportQuantum();

  const advanceTemporalMinute = (
    input: Readonly<{ automaticGrowth?: boolean }> = {},
  ): CommittedWorld => temporalPublication.advanceTemporalMinute(input);

  const resetSimulationForTest = (): CommittedWorld => {
    const publication = publishCommittedDomain(
      { simulation: createInitialSimulationSnapshot() },
      noOpPresentation,
    );
    if (publication.result.status === 'committed') {
      undoCoordinator.clear();
      return publication.result.world;
    }
    return transactionCoordinator.snapshot();
  };

  const setPresentationSuppressed = (suppressed: boolean): void => {
    presentationSuppressedForTest = suppressed;
  };

  const rebuildPresentationForTest = (): CommittedWorld => {
    const world = transactionCoordinator.snapshot();
    if (staticPresentationNeedsRebuild(lastPresentedStaticWorld, world)) {
      completeWorldPresentation.synchronize(world);
      lastPresentedStaticWorld = world;
    }
    return world;
  };

  const subscribeCommittedWorld = (subscriber: CommittedWorldSubscriber): (() => void) => {
    committedWorldSubscribers.add(subscriber);
    return () => committedWorldSubscribers.delete(subscriber);
  };
  const subscribeWorldSelection = (subscriber: WorldSelectionSubscriber): (() => void) => {
    worldSelectionSubscribers.add(subscriber);
    return () => worldSelectionSubscribers.delete(subscriber);
  };

  const resetCamera = (): void => {
    const layout = host.measureViewport();
    cameraRig.setViewport(layout.width, layout.height, layout.insets);
    cameraRig.resetToFit(WORLD_BOUNDS);
    renderViewport = toRenderViewport(layout);
    inputRef.current?.setViewport(renderViewport);
  };

  const input = createGameInput({
    canvas: host.canvas,
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
    onTerraformReject: (reason) => host.setStatus(statusForTerraformReason(reason)),
    onRoadPlan: applyRoadPlan,
    onZonePlan: applyZonePlan,
    onBuildingBulldoze: applyBuildingBulldozeRequest,
    onReset: resetCamera,
  });
  inputRef.current = input;

  let viewportInitialized = false;
  const updateViewport = (): void => {
    const layout = host.measureViewport();
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
    updateViewport();
  };

  const setToolMode = (mode: GameToolMode): void => {
    input.setToolMode(mode);
    if (mode !== 'navigate' && !grid.visible) grid.setVisible(true);
  };

  const setBrushSize = (size: TerraformBrushSize): void => {
    input.setBrushSize(size);
  };
  const setInformationView = (key: InformationViewKey): void => {
    grid.setVisible(key === 'grid');
  };

  updateViewport();
  applyQuality('medium');

  const abortController = new AbortController();
  const listenerOptions = { signal: abortController.signal };
  const saveWorld = (): void => {
    input.clearActiveSession();
    saveCoordinator.save();
    host.setStatus('Saved');
  };
  const loadWorld = (): void => {
    input.clearActiveSession();
    const result = saveCoordinator.load();
    if (result.status === 'rejected') {
      host.setStatus(result.reason === 'world:no-save' ? 'No save' : 'Invalid save');
      return;
    }
    adoptCommittedWorld(result.world, 'load');
    undoCoordinator.clear();
    host.setUndoAvailable(false);
    host.setStatus('Loaded');
  };
  const toggleGrid = (): void => {
    grid.setVisible(!grid.visible);
  };

  const undoLatest = (): void => {
    input.clearActiveSession();
    const kind = undoCoordinator.kind;
    const before = transactionCoordinator.snapshot();
    const result = undoCoordinator.undo();
    if (result === null || result.status === 'rejected') {
      host.setUndoAvailable(undoCoordinator.available);
      return;
    }
    adoptCommittedWorld(result.world, 'undo');
    if (kind === 'terraform') {
      terraformUndoCount += 1;
      terraformWaterRebuildCount += 1;
      host.setStatus('Terraform undone');
    } else if (kind === 'road') {
      const dirtyChunks = roadDirtyChunksBetween(before.roads, result.world.roads);
      roadUndoCount += 1;
      roadLastDirtyChunkCount = dirtyChunks.length;
      roadChunkRebuildCount += dirtyChunks.length;
      host.setStatus('Road undone');
    } else if (kind === 'zone') {
      const dirtyChunks = zoneDirtyChunksBetween(before.zones, result.world.zones);
      zoneUndoCount += 1;
      zoneLastDirtyChunkCount = dirtyChunks.length;
      zoneChunkRebuildCount += dirtyChunks.length;
      zoneInvalidReason = null;
      host.setStatus('Zone undone');
    } else if (kind === 'building') {
      buildingUndoCount += 1;
      buildingInvalidReason = null;
      host.setStatus('Building undone');
    }
    host.setUndoAvailable(undoCoordinator.available);
  };
  window.addEventListener('resize', updateViewport, listenerOptions);

  host.canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      contextLost = true;
      input.clearActiveSession();
      host.setStatus('Context lost');
    },
    listenerOptions,
  );
  host.canvas.addEventListener(
    'webglcontextrestored',
    () => {
      preview.clear();
      roadPreview.clear();
      zonePreview.clear();
      presentationCoordinator.rebuildFromCommitted(transactionCoordinator.snapshot());
      contextLost = false;
      host.setStatus('Ready');
    },
    listenerOptions,
  );

  publishInteractionEvidence({
    camera,
    cameraRig,
    config: WORLD_CONFIG,
    scene,
    input,
    framingMarginRatio,
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

  host.setUndoAvailable(false);
  host.setStatus('Ready');
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
    committedWorldSubscribers.clear();
    worldSelectionSubscribers.clear();
    delete window.__WEB_THREE_CITY_INTERACTION__;
  };
  window.addEventListener('pagehide', dispose, { once: true });
  return {
    snapshot: () => transactionCoordinator.snapshot(),
    snapshotForTest: () => transactionCoordinator.snapshotForTransaction(),
    subscribeCommittedWorld,
    subscribeWorldSelection,
    advanceLogicalTick,
    advanceGameMinute,
    advanceTransportQuantum,
    advanceTemporalMinute,
    setPresentationSuppressed,
    rebuildPresentationForTest,
    resetSimulationForTest,
    savePayload: () => saveCoordinator.savePayload(),
    runBackgroundGrowthTick,
    runSimulationOnlyTick,
    selectTool: setToolMode,
    setTerraformBrush: setBrushSize,
    submitTaxPolicy,
    setInformationView,
    saveWorld,
    loadWorld,
    rotateLeft: () => input.controller.rotateLeft(),
    rotateRight: () => input.controller.rotateRight(),
    resetCamera,
    toggleGrid,
    setQuality: applyQuality,
    undo: undoLatest,
    dispose,
  };
}
