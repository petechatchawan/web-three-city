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
  TerrainPresentation,
  TerraformPreviewPresentation,
} from '@web-three-city/terrain-three';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import {
  isRoadToolMode,
  isTerraformToolMode,
  type GameToolMode,
} from './game-tool-mode.js';
import {
  createRoadStrokeController,
  type RoadInputState,
} from './road-stroke-controller.js';
import { createTerraformPreviewSceneModel } from './terraform-preview-adapter.js';
import type { GameTerraformInvalidReason } from './terraform-road-guard.js';
import {
  createTerraformStrokeSession,
  type TerraformStrokeRelease,
  type TerraformStrokeSessionState,
} from './terraform-stroke-session.js';

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
  readonly config: WorldConfig;
  readonly getTerrainSnapshot: () => TerrainSnapshot;
  readonly getRoadSnapshot: () => RoadSnapshot;
  readonly getRoadEnvironment: () => RoadPlacementEnvironment;
  readonly onSelection: (cell: CellCoord | null) => void;
  readonly onTerraformCommit: (plan: TerraformPlan) => void;
  readonly onTerraformRelease?: (release: TerraformStrokeRelease) => void;
  readonly onTerraformState?: (state: TerraformStrokeSessionState) => void;
  readonly onTerraformReject?: (
    reason: GameTerraformInvalidReason | 'terraform:no-change',
  ) => void;
  readonly onRoadPlan: (plan: RoadMutationPlan) => void;
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
    onState(state): void {
      options.preview.show(
        createTerraformPreviewSceneModel(
          state,
          options.getTerrainSnapshot(),
          options.config,
        ),
      );
      options.onTerraformState?.(state);
    },
  });

  const roadController = createRoadStrokeController({
    config: options.config,
    getMode: () => (isRoadToolMode(mode) ? mode : null),
    getRoadSnapshot: options.getRoadSnapshot,
    getEnvironment: options.getRoadEnvironment,
    onPreview(plan, environment): void {
      if (plan === null || environment === null) options.roadPreview.clear();
      else options.roadPreview.show(plan, environment);
    },
  });

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
      else if (isTerraformToolMode(mode)) terraformSession.move(pointerId, cell);
    },
    end(pointerId: number, point: ScreenPoint): void {
      const result = pick(point);
      const cell = result === null ? null : { x: result.cellX, z: result.cellZ };
      if (isRoadToolMode(mode)) {
        if (cell === null) {
          roadController.cancel(pointerId);
          return;
        }
        const finalPlan = roadController.end(pointerId, cell);
        if (finalPlan !== null) options.onRoadPlan(finalPlan);
        return;
      }
      if (!isTerraformToolMode(mode)) return;
      const release = terraformSession.end(pointerId, cell);
      if (options.onTerraformRelease !== undefined) {
        options.onTerraformRelease(release);
      } else {
        routeTerraformRelease(
          release,
          options.onTerraformCommit,
          options.onTerraformReject ?? (() => undefined),
        );
      }
    },
    cancel(pointerId: number): void {
      roadController.cancel(pointerId);
      terraformSession.cancel(pointerId);
    },
    cancelAll(): void {
      roadController.cancelAll();
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
    terraformSession.cancelAll();
  };

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
      if (
        value !== 'navigate' &&
        value !== 'raise' &&
        value !== 'lower' &&
        value !== 'flatten' &&
        value !== 'road-build' &&
        value !== 'road-bulldoze'
      ) {
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
        mode: isRoadToolMode(mode) ? 'navigate' : mode,
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
    clearActiveSession(): void {
      clearAllSessions();
    },
    dispose(): void {
      binding?.dispose();
      binding = null;
      roadController.cancelAll();
      terraformSession.cancelAll();
      options.preview.clear();
      terrainObjects = [];
    },
  };
}
