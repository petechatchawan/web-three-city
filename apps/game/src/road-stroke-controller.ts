import {
  planRoadMutation,
  type RoadMutationPlan,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import { rasterizeTerraformCellLine } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import type { RoadToolMode } from './game-tool-mode.js';

export interface RoadInputState {
  readonly mode: RoadToolMode | null;
  readonly strokeActive: boolean;
  readonly previewValid: boolean | null;
  readonly previewCellCount: number;
}

export interface RoadStrokeController {
  begin(pointerId: number, cell: CellCoord): boolean;
  move(pointerId: number, cell: CellCoord): void;
  end(pointerId: number, cell: CellCoord): RoadMutationPlan | null;
  cancel(pointerId: number): void;
  cancelAll(): void;
  getState(): RoadInputState;
}

export interface CreateRoadStrokeControllerOptions {
  readonly config: WorldConfig;
  readonly getMode: () => RoadToolMode | null;
  readonly getRoadSnapshot: () => RoadSnapshot;
  readonly getEnvironment: () => RoadPlacementEnvironment;
  readonly onPreview: (
    plan: RoadMutationPlan | null,
    environment: RoadPlacementEnvironment | null,
  ) => void;
}

interface RoadStrokeSession {
  readonly pointerId: number;
  readonly mode: RoadToolMode;
  readonly roads: RoadSnapshot;
  readonly environment: RoadPlacementEnvironment;
  readonly cells: Map<string, CellCoord>;
  lastCell: CellCoord | null;
  plan: RoadMutationPlan | null;
}

function cellKey(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function operationForMode(mode: RoadToolMode): 'build' | 'bulldoze' {
  return mode === 'road-build' ? 'build' : 'bulldoze';
}

function copyCell(cell: CellCoord): CellCoord {
  return { x: cell.x, z: cell.z };
}

export function createRoadStrokeController(
  options: CreateRoadStrokeControllerOptions,
): RoadStrokeController {
  let session: RoadStrokeSession | null = null;

  const clear = (): void => {
    if (session === null) return;
    session = null;
    options.onPreview(null, null);
  };

  const replan = (): void => {
    if (session === null || session.cells.size === 0) return;
    session.plan = planRoadMutation(
      session.roads,
      {
        operation: operationForMode(session.mode),
        definitionId: 'basic-road',
        cells: [...session.cells.values()],
      },
      session.environment,
      options.config,
    );
    options.onPreview(session.plan, session.environment);
  };

  const addCell = (cell: CellCoord): void => {
    if (session === null) return;
    const previousSize = session.cells.size;
    if (session.lastCell === null) {
      session.cells.set(cellKey(cell), copyCell(cell));
    } else {
      for (const traversed of rasterizeTerraformCellLine(session.lastCell, cell)) {
        session.cells.set(cellKey(traversed), copyCell(traversed));
      }
    }
    session.lastCell = copyCell(cell);
    if (session.cells.size !== previousSize || session.plan === null) replan();
  };

  return {
    begin(pointerId: number, cell: CellCoord): boolean {
      const mode = options.getMode();
      if (mode === null || session !== null) return false;
      session = {
        pointerId,
        mode,
        roads: options.getRoadSnapshot(),
        environment: options.getEnvironment(),
        cells: new Map<string, CellCoord>(),
        lastCell: null,
        plan: null,
      };
      addCell(cell);
      return true;
    },
    move(pointerId: number, cell: CellCoord): void {
      if (session?.pointerId !== pointerId) return;
      addCell(cell);
    },
    end(pointerId: number, cell: CellCoord): RoadMutationPlan | null {
      if (session?.pointerId !== pointerId) return null;
      addCell(cell);
      const finalPlan = session.plan;
      clear();
      return finalPlan;
    },
    cancel(pointerId: number): void {
      if (session?.pointerId === pointerId) clear();
    },
    cancelAll(): void {
      clear();
    },
    getState(): RoadInputState {
      const mode = options.getMode();
      return {
        mode,
        strokeActive: session !== null,
        previewValid: session?.plan?.valid ?? null,
        previewCellCount: session?.plan?.requestedCells.length ?? 0,
      };
    },
  };
}
