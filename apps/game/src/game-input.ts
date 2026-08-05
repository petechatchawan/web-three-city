import type { BuildingSnapshot } from '@web-three-city/building-core';
import {
  createBuildingToolController,
  type BuildingInputState,
} from './building-tool-controller.js';
import {
  CameraInteractionController,
  bindWorldInput,
  pickTerrain,
  type OrthographicCameraRig,
  type PrimaryPointerToolDelegate,
  type ScreenPoint,
  type TerrainAnchorResolver,
  type TerrainPickResult,
  type WorldInputBinding,
} from '@web-three-city/camera-input';
import type {
  RoadMutationPlan,
  RoadPlacementEnvironment,
  RoadSnapshot,
} from '@web-three-city/road-core';
import {
  allChunkCoords,
  type TerrainSnapshot,
  type TerraformBrushSize,
  type TerraformPlan,
  type WorldToolMode,
} from '@web-three-city/terrain-core';
import type { RoadPreviewPresentation } from '@web-three-city/road-three';
import type {
  ZoneMutationPlan,
  ZonePlacementEnvironment,
  ZoneSnapshot,
} from '@web-three-city/zone-core';
import type { ZonePreviewPresentation } from '@web-three-city/zone-three';
import type {
  TerrainPresentation,
  TerraformPreviewPresentation,
} from '@web-three-city/terrain-three';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import {
  isBuildingToolMode,
  isGameToolMode,
  isRoadToolMode,
  isTerraformToolMode,
  isZoneToolMode,
  type GameToolMode,
} from './game-tool-mode.js';
import {
  bindGameToolCancel,
  dispatchGameToolEvent,
  dispatchGameTransactionState,
} from './game-tool-events.js';
import {
  roadPlanTransaction,
  terraformReleaseTransaction,
  zonePlanTransaction,
} from './game-transaction-presentation.js';
import { createRoadStrokeController, type RoadInputState } from './road-stroke-controller.js';
import { createTerraformPreviewSceneModel } from './terraform-preview-adapter.js';
import type {
  GuardedRoadBuildingCandidate,
  GameRoadBuildingInvalidReason,
} from './road-building-guard.js';
import type { GameTerraformInvalidReason } from './terraform-occupancy-guard.js';
import { createGuardedZonePresentation } from './zone-building-presentation.js';
import type { GuardedZoneCandidate, GameZoneInvalidReason } from './zone-building-guard.js';
import {
  createTerraformStrokeSession,
  type TerraformStrokeRelease,
  type TerraformStrokeSessionState,
} from './terraform-stroke-session.js';
import { createZoneStrokeController, type ZoneInputState } from './zone-stroke-controller.js';

export interface GameRenderViewport {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
}

export interface TerraformInputState {
  readonly mode: WorldToolMode;
  readonly brushSize: TerraformBrushSize;
  readonly strokeActive: boolean;
  readonly previewValid: boolean | null;
  readonly previewInvalidReason: GameTerraformInvalidReason | null;
  readonly previewCellCount: number;
  readonly acceptedStampCount: number;
  readonly supportCellCount: number;
  readonly currentStampKind: TerraformStrokeSessionState['currentStamp']['kind'];
  readonly flattenTargetLevel: number | null;
}

export interface GameInput {
  readonly controller: CameraInteractionController;
  readonly activePointerCount: number;
  setViewport(viewport: GameRenderViewport): void;
  refreshTerrainObjects(): void;
  setToolMode(mode: GameToolMode): void;
  setBrushSize(size: TerraformBrushSize): void;
  getTerraformState(): TerraformInputState;
  getRoadState(): RoadInputState;
  getZoneState(): ZoneInputState;
  getBuildingState(): BuildingInputState;
  clearActiveSession(): void;
  dispose(): void;
}

export interface CreateGameInputOptions {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.OrthographicCamera;
  readonly cameraRig: OrthographicCameraRig;
  readonly terrain: TerrainPresentation;
  readonly preview: TerraformPreviewPresentation;
  readonly roadPreview: RoadPreviewPresentation;
  readonly zonePreview: ZonePreviewPresentation;
  readonly config: WorldConfig;
  readonly getTerrainSnapshot: () => TerrainSnapshot;
  readonly getRoadSnapshot: () => RoadSnapshot;
  readonly getRoadEnvironment: () => RoadPlacementEnvironment;
  readonly getZoneSnapshot: () => ZoneSnapshot;
  readonly getZoneEnvironment: () => ZonePlacementEnvironment;
  readonly getBuildingSnapshot?: () => BuildingSnapshot;
  readonly guardRoadPlan?: (
    plan: RoadMutationPlan,
    baseRoads: RoadSnapshot,
  ) => GuardedRoadBuildingCandidate;
  readonly onSelection: (cell: CellCoord | null) => void;
  readonly onTerraformCommit: (plan: TerraformPlan) => void;
  readonly onTerraformRelease?: (release: TerraformStrokeRelease) => void;
  readonly onTerraformState?: (state: TerraformStrokeSessionState) => void;
  readonly onTerraformReject?: (reason: GameTerraformInvalidReason | 'terraform:no-change') => void;
  readonly onRoadPlan: (
    plan: RoadMutationPlan,
    reason?: GameRoadBuildingInvalidReason | null,
  ) => void;
  readonly guardZonePlan?: (plan: ZoneMutationPlan) => GuardedZoneCandidate;
  readonly onZonePlan: (plan: ZoneMutationPlan, reason?: GameZoneInvalidReason | null) => void;
  readonly onBuildingBulldoze?: (cell: CellCoord) => void;
  readonly onReset: () => void;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function routeTerraformRelease(
  release: TerraformStrokeRelease,
  commit: (plan: TerraformPlan) => void,
  reject: (reason: GameTerraformInvalidReason | 'terraform:no-change') => void,
): void {
  if (release.kind === 'commit') {
    commit(release.plan);
  } else if (release.kind === 'rejected') {
    reject(release.reason);
  } else if (release.kind === 'no-change') {
    reject('terraform:no-change');
  }
}

export type RoadPreviewPort = Pick<RoadPreviewPresentation, 'clear' | 'show'>;

export type ZonePreviewPort = Pick<ZonePreviewPresentation, 'clear' | 'show'>;

export function routeZonePreview(
  zonePreview: ZonePreviewPort,
  baseZones: ZoneSnapshot | null,
  plan: ZoneMutationPlan | null,
): void {
  if (baseZones === null || plan === null) {
    zonePreview.clear();
    return;
  }
  zonePreview.show(baseZones, plan);
}

export function routeRoadPreview(
  roadPreview: RoadPreviewPort,
  baseRoads: RoadSnapshot | null,
  plan: RoadMutationPlan | null,
  environment: RoadPlacementEnvironment | null,
): void {
  if (baseRoads === null || plan === null || environment === null) {
    roadPreview.clear();
    return;
  }
  roadPreview.show(baseRoads, plan, environment);
}

export function createGameInput(options: CreateGameInputOptions): GameInput {
  const raycaster = new THREE.Raycaster();
  let terrainObjects: readonly THREE.Object3D[] = [];
  let viewport: GameRenderViewport = {
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    canvasWidth: 1,
    canvasHeight: 1,
  };
  let mode: GameToolMode = 'navigate';
  let brushSize: TerraformBrushSize = 1;

  const refreshTerrainObjects = (): void => {
    terrainObjects = allChunkCoords(options.config).map((chunk) =>
      options.terrain.getChunkMesh(chunk),
    );
  };

  const pick = (point: ScreenPoint): TerrainPickResult | null => {
    if (
      point.x < viewport.left ||
      point.y < viewport.top ||
      point.x >= viewport.left + viewport.width ||
      point.y >= viewport.top + viewport.height
    ) {
      return null;
    }
    return pickTerrain({
      raycaster,
      camera: options.camera,
      ndc: {
        x: ((point.x - viewport.left) / viewport.width) * 2 - 1,
        y: -((point.y - viewport.top) / viewport.height) * 2 + 1,
      },
      objects: terrainObjects,
      config: options.config,
    });
  };

  const terraformSession = createTerraformStrokeSession({
    config: options.config,
    getTerrainSnapshot: options.getTerrainSnapshot,
    getRoadSnapshot: options.getRoadSnapshot,
    getZoneSnapshot: options.getZoneSnapshot,
    ...(options.getBuildingSnapshot === undefined
      ? {}
      : { getBuildingSnapshot: options.getBuildingSnapshot }),
    onState(state): void {
      options.preview.show(
        createTerraformPreviewSceneModel(state, options.getTerrainSnapshot(), options.config),
      );
      dispatchGameToolEvent(options.canvas, Object.freeze({ type: 'terraform-state', state }));
      options.onTerraformState?.(state);
    },
  });

  const guardRoad = (
    plan: RoadMutationPlan,
    baseRoads: RoadSnapshot,
  ): GuardedRoadBuildingCandidate =>
    options.guardRoadPlan?.(plan, baseRoads) ??
    Object.freeze({
      corePlan: plan,
      previewPlan: plan,
      valid: plan.valid,
      invalidReason: plan.invalidReason,
      blockedZoneCells: Object.freeze([]),
      blockedBuildingCells: Object.freeze([]),
    });

  const roadController = createRoadStrokeController({
    config: options.config,
    getMode: () => (isRoadToolMode(mode) ? mode : null),
    getRoadSnapshot: options.getRoadSnapshot,
    getEnvironment: options.getRoadEnvironment,
    onPreview(baseRoads, plan, environment): void {
      const candidate = baseRoads === null || plan === null ? null : guardRoad(plan, baseRoads);
      routeRoadPreview(options.roadPreview, baseRoads, candidate?.previewPlan ?? null, environment);
      dispatchGameToolEvent(
        options.canvas,
        Object.freeze({
          type: 'road-state',
          state: Object.freeze({
            mode: isRoadToolMode(mode) ? mode : null,
            strokeActive: candidate !== null,
            previewValid: candidate?.valid ?? null,
            previewCellCount: plan?.requestedCells.length ?? 0,
          }),
          reason: candidate?.invalidReason ?? null,
        }),
      );
    },
  });

  const zoneController = createZoneStrokeController({
    config: options.config,
    getMode: () => (isZoneToolMode(mode) ? mode : null),
    getZoneSnapshot: options.getZoneSnapshot,
    getEnvironment: options.getZoneEnvironment,
    onPreview(baseZones, plan): void {
      const candidate =
        plan === null
          ? null
          : (options.guardZonePlan?.(plan) ??
            Object.freeze({
              corePlan: plan,
              previewPlan: plan,
              valid: plan.valid,
              invalidReason: plan.invalidReason,
              blockedBuildingCells: Object.freeze([]),
            }));
      routeZonePreview(options.zonePreview, baseZones, candidate?.previewPlan ?? null);
      const presentation = createGuardedZonePresentation(
        isZoneToolMode(mode) ? mode : null,
        candidate,
      );
      dispatchGameToolEvent(options.canvas, Object.freeze({ type: 'zone-state', ...presentation }));
    },
  });

  const buildingController = createBuildingToolController(() =>
    isBuildingToolMode(mode) ? mode : null,
  );

  const rejectTerraform = (reason: GameTerraformInvalidReason | 'terraform:no-change'): void => {
    dispatchGameToolEvent(options.canvas, Object.freeze({ type: 'reason', reason }));
    options.onTerraformReject?.(reason);
  };

  const tool: PrimaryPointerToolDelegate = {
    isEnabled(): boolean {
      return mode !== 'navigate';
    },
    begin(pointerId: number, point: ScreenPoint): boolean {
      if (mode === 'navigate') return false;
      const result = pick(point);
      if (result === null) return false;
      const cell = { x: result.cellX, z: result.cellZ };

      if (isRoadToolMode(mode)) return roadController.begin(pointerId, cell);
      if (isZoneToolMode(mode)) return zoneController.begin(pointerId, cell);
      if (isBuildingToolMode(mode)) return buildingController.begin(pointerId, cell);
      if (!isTerraformToolMode(mode)) return false;

      if (mode === 'flatten') {
        const target = clamp(
          Math.floor(result.worldPoint.y / options.config.heightStep + 0.5),
          options.config.minHeightLevel,
          options.config.maxHeightLevel,
        );
        return terraformSession.begin(pointerId, mode, brushSize, cell, target);
      }
      return terraformSession.begin(pointerId, mode, brushSize, cell);
    },
    move(pointerId: number, point: ScreenPoint): void {
      const result = pick(point);
      if (result === null) return;
      const cell = { x: result.cellX, z: result.cellZ };
      if (isRoadToolMode(mode)) roadController.move(pointerId, cell);
      else if (isZoneToolMode(mode)) zoneController.move(pointerId, cell);
      else if (isBuildingToolMode(mode)) buildingController.move(pointerId, cell);
      else if (isTerraformToolMode(mode)) terraformSession.move(pointerId, cell);
    },
    end(pointerId: number, point: ScreenPoint): void {
      const result = pick(point);
      const cell = result === null ? null : { x: result.cellX, z: result.cellZ };
      if (isRoadToolMode(mode)) {
        const finalPlan = roadController.end(pointerId, cell);
        const candidate =
          finalPlan === null ? null : guardRoad(finalPlan, options.getRoadSnapshot());
        const transaction = roadPlanTransaction(candidate?.previewPlan ?? null);
        if (transaction !== null) {
          dispatchGameTransactionState(options.canvas, transaction.state, transaction.domain);
        }
        if (candidate !== null) {
          options.onRoadPlan(candidate.previewPlan, candidate.invalidReason);
        }
        return;
      }
      if (isZoneToolMode(mode)) {
        const rawPlan = zoneController.end(pointerId, cell);
        const candidate =
          rawPlan === null
            ? null
            : (options.guardZonePlan?.(rawPlan) ??
              Object.freeze({
                corePlan: rawPlan,
                previewPlan: rawPlan,
                valid: rawPlan.valid,
                invalidReason: rawPlan.invalidReason,
                blockedBuildingCells: Object.freeze([]),
              }));
        const finalPlan = candidate?.previewPlan ?? null;
        const transaction = zonePlanTransaction(finalPlan);
        if (transaction !== null) {
          dispatchGameTransactionState(options.canvas, transaction.state, transaction.domain);
        }
        if (finalPlan !== null) options.onZonePlan(finalPlan, candidate?.invalidReason ?? null);
        return;
      }
      if (isBuildingToolMode(mode)) {
        const request = buildingController.end(pointerId, cell);
        if (request !== null) options.onBuildingBulldoze?.(request.cell);
        return;
      }
      if (!isTerraformToolMode(mode)) return;
      const release = terraformSession.end(pointerId, cell);
      const transaction = terraformReleaseTransaction(release);
      if (transaction !== null) {
        dispatchGameTransactionState(options.canvas, transaction.state, transaction.domain);
      }
      if (options.onTerraformRelease !== undefined) {
        options.onTerraformRelease(release);
      } else {
        routeTerraformRelease(release, options.onTerraformCommit, rejectTerraform);
      }
    },
    cancel(pointerId: number): void {
      roadController.cancel(pointerId);
      zoneController.cancel(pointerId);
      buildingController.cancel(pointerId);
      terraformSession.cancel(pointerId);
    },
    cancelAll(): void {
      roadController.cancelAll();
      zoneController.cancelAll();
      buildingController.cancelAll();
      terraformSession.cancelAll();
    },
  };

  const resolver: TerrainAnchorResolver = { pick };
  const controller = new CameraInteractionController(options.cameraRig, resolver);
  let binding: WorldInputBinding | null = bindWorldInput({
    canvas: options.canvas,
    keyboardTarget: window,
    camera: controller,
    tool,
    onEligibleTap: (point) => {
      const result = pick(point);
      options.onSelection(result === null ? null : { x: result.cellX, z: result.cellZ });
    },
    onReset: options.onReset,
  });

  refreshTerrainObjects();

  const clearAllSessions = (): void => {
    binding?.clearActiveSession();
    roadController.cancelAll();
    zoneController.cancelAll();
    buildingController.cancelAll();
    terraformSession.cancelAll();
  };
  const toolEventController = new AbortController();
  bindGameToolCancel(options.canvas, clearAllSessions, toolEventController.signal);

  return {
    controller,
    get activePointerCount(): number {
      return binding?.activePointerCount ?? 0;
    },
    setViewport(value: GameRenderViewport): void {
      viewport = { ...value };
    },
    refreshTerrainObjects,
    setToolMode(value: GameToolMode): void {
      if (!isGameToolMode(value)) {
        throw new RangeError('game-input:invalid-tool-mode');
      }
      clearAllSessions();
      mode = value;
    },
    setBrushSize(value: TerraformBrushSize): void {
      if (value !== 1 && value !== 3 && value !== 5) {
        throw new RangeError('game-input:invalid-brush-size');
      }
      clearAllSessions();
      brushSize = value;
    },
    getTerraformState(): TerraformInputState {
      const state = terraformSession.getState();
      const previewInvalidReason =
        state.currentStamp.kind === 'rejected'
          ? state.currentStamp.reason
          : state.currentStamp.kind === 'no-change'
            ? 'terraform:no-change'
            : null;
      const previewValid =
        state.currentStamp.kind === 'accepted'
          ? true
          : state.currentStamp.kind === 'rejected'
            ? false
            : state.acceptedPlan === null
              ? null
              : true;
      const previewCellCount =
        state.currentStamp.kind === 'rejected' || state.currentStamp.kind === 'no-change'
          ? state.currentStamp.preview.corePlan.affectedCells.length
          : (state.acceptedPlan?.affectedCells.length ?? 0);
      return {
        mode:
          isRoadToolMode(mode) || isZoneToolMode(mode) || isBuildingToolMode(mode)
            ? 'navigate'
            : mode,
        brushSize,
        strokeActive: state.strokeActive,
        previewValid,
        previewInvalidReason,
        previewCellCount,
        acceptedStampCount: state.acceptedAnchors.length,
        supportCellCount: state.acceptedPlan?.supportCells.length ?? 0,
        currentStampKind: state.currentStamp.kind,
        flattenTargetLevel: state.flattenTargetLevel,
      };
    },
    getRoadState(): RoadInputState {
      return roadController.getState();
    },
    getZoneState(): ZoneInputState {
      return zoneController.getState();
    },
    getBuildingState(): BuildingInputState {
      return buildingController.getState();
    },
    clearActiveSession(): void {
      clearAllSessions();
    },
    dispose(): void {
      toolEventController.abort();
      binding?.dispose();
      binding = null;
      roadController.cancelAll();
      zoneController.cancelAll();
      buildingController.cancelAll();
      terraformSession.cancelAll();
      options.preview.clear();
      terrainObjects = [];
    },
  };
}
