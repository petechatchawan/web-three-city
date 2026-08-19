import {
  planRoadMutation,
  type RoadDefinitionId,
  type RoadMutationPlan,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import type { RoadToolMode } from './game-tool-mode.js';
import { createReversibleCellTrace, type ReversibleCellTrace } from './reversible-cell-trace.js';

export interface RoadInputState {
  readonly mode: 'road-build' | 'road-bulldoze' | null;
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
  readonly definitionId: RoadDefinitionId;
  readonly roads: RoadSnapshot;
  readonly environment: RoadPlacementEnvironment;
  readonly trace: ReversibleCellTrace;
  plan: RoadMutationPlan | null;
}

function operationForMode(mode: RoadToolMode): 'build' | 'bulldoze' {
  return mode === 'road-bulldoze' ? 'bulldoze' : 'build';
}

function inputModeForMode(mode: RoadToolMode | null): RoadInputState['mode'] {
  if (mode === null) return null;
  return operationForMode(mode) === 'bulldoze' ? 'road-bulldoze' : 'road-build';
}

function definitionForMode(mode: RoadToolMode): RoadDefinitionId {
  switch (mode) {
    case 'road-build-collector':
      return 'collector-road';
    case 'road-build-arterial':
      return 'arterial-road';
    case 'road-build':
    case 'road-bulldoze':
      return 'basic-road';
  }
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
    if (session === null) return;
    session.plan = planRoadMutation(
      session.roads,
      {
        operation: operationForMode(session.mode),
        definitionId: session.definitionId,
        cells: session.trace.cells(),
      },
      session.environment,
      options.config,
    );
    options.onPreview(session.roads, session.plan, session.environment);
  };

  const updateTrace = (cell: CellCoord): void => {
    if (session === null) return;
    if (session.trace.extendTo(cell) || session.plan === null) replan();
  };

  return {
    begin(pointerId: number, cell: CellCoord): boolean {
      const mode = options.getMode();
      if (mode === null || session !== null) return false;
      session = {
        pointerId,
        mode,
        definitionId: definitionForMode(mode),
        roads: options.getRoadSnapshot(),
        environment: options.getEnvironment(),
        trace: createReversibleCellTrace(cell),
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
        mode: inputModeForMode(mode),
        strokeActive: session !== null,
        previewValid: session?.plan?.valid ?? null,
        previewCellCount: session?.plan?.requestedCells.length ?? 0,
      };
    },
  };
}
