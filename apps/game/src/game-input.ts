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
  planTerraformStroke,
  rasterizeTerraformCellLine,
  type TerrainSnapshot,
  type TerraformBrushSize,
  type TerraformPlan,
  type WorldToolMode,
} from '@web-three-city/terrain-core';
import type {
  TerrainPresentation,
  TerraformPreviewPresentation,
} from '@web-three-city/terrain-three';
import type { RoadPreviewPresentation } from '@web-three-city/road-three';
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
  readonly previewCellCount: number;
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
  readonly onRoadPlan: (plan: RoadMutationPlan) => void;
  readonly onReset: () => void;
}

function cellKey(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
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
  let terraformPointerId: number | null = null;
  let terraformBase: TerrainSnapshot | null = null;
  let terraformLastCell: CellCoord | null = null;
  let terraformFlattenTarget: number | undefined;
  let terraformPlan: TerraformPlan | null = null;
  const terraformCenters = new Map<string, CellCoord>();

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

  const clearTerraformStroke = (): void => {
    terraformPointerId = null;
    terraformBase = null;
    terraformLastCell = null;
    terraformFlattenTarget = undefined;
    terraformPlan = null;
    terraformCenters.clear();
    options.preview.clear();
  };

  const rebuildTerraformPlan = (): void => {
    if (terraformBase === null || !isTerraformToolMode(mode) || terraformCenters.size === 0) {
      return;
    }
    const cells = [...terraformCenters.values()];
    const plan =
      mode === 'flatten'
        ? planTerraformStroke(
            terraformBase,
            {
              operation: 'flatten',
              brushSize,
              cells,
              flattenTargetLevel:
                terraformFlattenTarget ?? options.config.minHeightLevel,
            },
            options.config,
          )
        : planTerraformStroke(
            terraformBase,
            {
              operation: mode,
              brushSize,
              cells,
            },
            options.config,
          );
    terraformPlan = plan;
    options.preview.show(plan);
  };

  const addTerraformCell = (cell: CellCoord): void => {
    const previousSize = terraformCenters.size;
    if (terraformLastCell === null) {
      terraformCenters.set(cellKey(cell), { ...cell });
    } else {
      for (const traversed of rasterizeTerraformCellLine(terraformLastCell, cell)) {
        terraformCenters.set(cellKey(traversed), { ...traversed });
      }
    }
    terraformLastCell = { ...cell };
    if (terraformCenters.size !== previousSize || terraformPlan === null) {
      rebuildTerraformPlan();
    }
  };

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
      if (!isTerraformToolMode(mode) || terraformPointerId !== null) return false;

      terraformPointerId = pointerId;
      terraformBase = options.getTerrainSnapshot();
      terraformLastCell = null;
      terraformPlan = null;
      terraformCenters.clear();
      terraformFlattenTarget =
        mode === 'flatten'
          ? clamp(
              Math.round(result.worldPoint.y / options.config.heightStep),
              options.config.minHeightLevel,
              options.config.maxHeightLevel,
            )
          : undefined;
      addTerraformCell(cell);
      return true;
    },
    move(pointerId: number, point: ScreenPoint): void {
      const result = pick(point);
      if (result === null) return;
      const cell = { x: result.cellX, z: result.cellZ };
      if (isRoadToolMode(mode)) roadController.move(pointerId, cell);
      else if (pointerId === terraformPointerId) addTerraformCell(cell);
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
      if (pointerId !== terraformPointerId) return;
      if (cell !== null) addTerraformCell(cell);
      const finalPlan = terraformPlan;
      clearTerraformStroke();
      if (finalPlan?.valid === true) options.onTerraformCommit(finalPlan);
    },
    cancel(pointerId: number): void {
      roadController.cancel(pointerId);
      if (pointerId === terraformPointerId) clearTerraformStroke();
    },
    cancelAll(): void {
      roadController.cancelAll();
      if (terraformPointerId !== null || terraformPlan !== null) clearTerraformStroke();
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
    clearTerraformStroke();
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
      return {
        mode: isRoadToolMode(mode) ? 'navigate' : mode,
        brushSize,
        strokeActive: terraformPointerId !== null,
        previewValid: terraformPlan?.valid ?? null,
        previewCellCount: terraformPlan?.affectedCells.length ?? 0,
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
      clearTerraformStroke();
      terrainObjects = [];
    },
  };
}
