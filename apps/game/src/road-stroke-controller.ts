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
  end(pointerId: number, cell: CellCoord | null): RoadMutationPlan | null;
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
    baseRoads: RoadSnapshot | null,
    plan: RoadMutationPlan | null,
    environment: RoadPlacementEnvironment | null,
  ) => void;
}

interface RoadStrokeSession {
  readonly pointerId: number;
  readonly mode: RoadToolMode;
  readonly roads: RoadSnapshot;
  readonly environment: RoadPlacementEnvironment;
  readonly trace: CellCoord[];
  lastCell: CellCoord;
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

function sameCell(first: CellCoord, second: CellCoord): boolean {
  return first.x === second.x && first.z === second.z;
}

function activeCells(trace: readonly CellCoord[]): readonly CellCoord[] {
  const unique = new Map<string, CellCoord>();
  for (const cell of trace) {
    if (!unique.has(cellKey(cell))) unique.set(cellKey(cell), copyCell(cell));
  }
  return [...unique.values()];
}

export function createRoadStrokeController(
  options: CreateRoadStrokeControllerOptions,
): RoadStrokeController {
  let session: RoadStrokeSession | null = null;

  const clear = (): void => {
    if (session === null) return;
    session = null;
    options.onPreview(null, null, null);
  };

  const replan = (): void => {
    if (session === null || session.trace.length === 0) return;
    session.plan = planRoadMutation(
      session.roads,
      {
        operation: operationForMode(session.mode),
        definitionId: 'basic-road',
        cells: activeCells(session.trace),
      },
      session.environment,
      options.config,
    );
    options.onPreview(session.roads, session.plan, session.environment);
  };

  const processTraceCell = (cell: CellCoord): boolean => {
    if (session === null) return false;
    const tail = session.trace.at(-1);
    if (tail !== undefined && sameCell(tail, cell)) return false;

    const previous = session.trace.at(-2);
    if (previous !== undefined && sameCell(previous, cell)) {
      session.trace.pop();
      return true;
    }

    session.trace.push(copyCell(cell));
    return true;
  };

  const updateTrace = (cell: CellCoord): void => {
    if (session === null) return;
    let changed = false;
    for (const traversed of rasterizeTerraformCellLine(session.lastCell, cell)) {
      changed = processTraceCell(traversed) || changed;
    }
    session.lastCell = copyCell(cell);
    if (changed || session.plan === null) replan();
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
        trace: [copyCell(cell)],
        lastCell: copyCell(cell),
        plan: null,
      };
      replan();
      return true;
    },
    move(pointerId: number, cell: CellCoord): void {
      if (session?.pointerId !== pointerId) return;
      updateTrace(cell);
    },
    end(pointerId: number, cell: CellCoord | null): RoadMutationPlan | null {
      if (session?.pointerId !== pointerId) return null;
      if (cell !== null) updateTrace(cell);
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
