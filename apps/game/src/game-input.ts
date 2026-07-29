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
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';

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
  setToolMode(mode: WorldToolMode): void;
  setBrushSize(size: TerraformBrushSize): void;
  getTerraformState(): TerraformInputState;
  clearActiveSession(): void;
  dispose(): void;
}

export interface CreateGameInputOptions {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.OrthographicCamera;
  readonly cameraRig: OrthographicCameraRig;
  readonly terrain: TerrainPresentation;
  readonly preview: TerraformPreviewPresentation;
  readonly config: WorldConfig;
  readonly getTerrainSnapshot: () => TerrainSnapshot;
  readonly onSelection: (cell: CellCoord | null) => void;
  readonly onTerraformCommit: (plan: TerraformPlan) => void;
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
  let mode: WorldToolMode = 'navigate';
  let brushSize: TerraformBrushSize = 1;
  let strokePointerId: number | null = null;
  let strokeBase: TerrainSnapshot | null = null;
  let strokeLastCell: CellCoord | null = null;
  let strokeFlattenTarget: number | undefined;
  let strokePlan: TerraformPlan | null = null;
  const strokeCenters = new Map<string, CellCoord>();

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

  const clearStroke = (): void => {
    strokePointerId = null;
    strokeBase = null;
    strokeLastCell = null;
    strokeFlattenTarget = undefined;
    strokePlan = null;
    strokeCenters.clear();
    options.preview.clear();
  };

  const rebuildStrokePlan = (): void => {
    if (strokeBase === null || mode === 'navigate' || strokeCenters.size === 0) return;
    const cells = [...strokeCenters.values()];
    const plan =
      mode === 'flatten'
        ? planTerraformStroke(
            strokeBase,
            {
              operation: 'flatten',
              brushSize,
              cells,
              flattenTargetLevel: strokeFlattenTarget ?? options.config.minHeightLevel,
            },
            options.config,
          )
        : planTerraformStroke(
            strokeBase,
            {
              operation: mode,
              brushSize,
              cells,
            },
            options.config,
          );
    strokePlan = plan;
    options.preview.show(plan);
  };

  const addStrokeCell = (cell: CellCoord): void => {
    const previousSize = strokeCenters.size;
    if (strokeLastCell === null) {
      strokeCenters.set(cellKey(cell), { ...cell });
    } else {
      for (const traversed of rasterizeTerraformCellLine(strokeLastCell, cell)) {
        strokeCenters.set(cellKey(traversed), { ...traversed });
      }
    }
    strokeLastCell = { ...cell };
    if (strokeCenters.size !== previousSize || strokePlan === null) rebuildStrokePlan();
  };

  const tool: PrimaryPointerToolDelegate = {
    isEnabled(): boolean {
      return mode !== 'navigate';
    },
    begin(pointerId: number, point: ScreenPoint): boolean {
      if (mode === 'navigate' || strokePointerId !== null) return false;
      const result = pick(point);
      if (result === null) return false;

      strokePointerId = pointerId;
      strokeBase = options.getTerrainSnapshot();
      strokeLastCell = null;
      strokePlan = null;
      strokeCenters.clear();
      strokeFlattenTarget =
        mode === 'flatten'
          ? clamp(
              Math.round(result.worldPoint.y / options.config.heightStep),
              options.config.minHeightLevel,
              options.config.maxHeightLevel,
            )
          : undefined;
      addStrokeCell({ x: result.cellX, z: result.cellZ });
      return true;
    },
    move(pointerId: number, point: ScreenPoint): void {
      if (pointerId !== strokePointerId) return;
      const result = pick(point);
      if (result !== null) addStrokeCell({ x: result.cellX, z: result.cellZ });
    },
    end(pointerId: number, point: ScreenPoint): void {
      if (pointerId !== strokePointerId) return;
      const result = pick(point);
      if (result !== null) addStrokeCell({ x: result.cellX, z: result.cellZ });
      const finalPlan = strokePlan;
      clearStroke();
      if (finalPlan?.valid === true) options.onTerraformCommit(finalPlan);
    },
    cancel(pointerId: number): void {
      if (pointerId === strokePointerId) clearStroke();
    },
    cancelAll(): void {
      if (strokePointerId !== null || strokePlan !== null) clearStroke();
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

  return {
    controller,
    get activePointerCount(): number {
      return binding?.activePointerCount ?? 0;
    },
    setViewport(value: GameRenderViewport): void {
      viewport = { ...value };
    },
    refreshTerrainObjects,
    setToolMode(value: WorldToolMode): void {
      if (value !== 'navigate' && value !== 'raise' && value !== 'lower' && value !== 'flatten') {
        throw new RangeError('game-input:invalid-tool-mode');
      }
      binding?.clearActiveSession();
      mode = value;
    },
    setBrushSize(value: TerraformBrushSize): void {
      if (value !== 1 && value !== 3 && value !== 5) {
        throw new RangeError('game-input:invalid-brush-size');
      }
      binding?.clearActiveSession();
      brushSize = value;
    },
    getTerraformState(): TerraformInputState {
      return {
        mode,
        brushSize,
        strokeActive: strokePointerId !== null,
        previewValid: strokePlan?.valid ?? null,
        previewCellCount: strokePlan?.affectedCells.length ?? 0,
      };
    },
    clearActiveSession(): void {
      binding?.clearActiveSession();
      clearStroke();
    },
    dispose(): void {
      binding?.dispose();
      binding = null;
      clearStroke();
      terrainObjects = [];
    },
  };
}
