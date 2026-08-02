import {
  planZoneMutation,
  type ZoneDefinitionId,
  type ZoneMutationPlan,
  type ZonePlacementEnvironment,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import type { ZoneToolMode } from './game-tool-mode.js';
import {
  createReversibleCellTrace,
  type ReversibleCellTrace,
} from './reversible-cell-trace.js';

export interface ZoneInputState {
  readonly mode: ZoneToolMode | null;
  readonly strokeActive: boolean;
  readonly previewValid: boolean | null;
  readonly previewCellCount: number;
}

export interface ZoneStrokeController {
  begin(pointerId: number, cell: CellCoord): boolean;
  move(pointerId: number, cell: CellCoord): void;
  end(pointerId: number, cell: CellCoord | null): ZoneMutationPlan | null;
  cancel(pointerId: number): void;
  cancelAll(): void;
  getState(): ZoneInputState;
}

export interface CreateZoneStrokeControllerOptions {
  readonly config: WorldConfig;
  readonly getMode: () => ZoneToolMode | null;
  readonly getZoneSnapshot: () => ZoneSnapshot;
  readonly getEnvironment: () => ZonePlacementEnvironment;
  readonly onPreview: (
    baseZones: ZoneSnapshot | null,
    plan: ZoneMutationPlan | null,
    environment: ZonePlacementEnvironment | null,
  ) => void;
}

interface ZoneStrokeSession {
  readonly pointerId: number;
  readonly mode: ZoneToolMode;
  readonly zones: ZoneSnapshot;
  readonly environment: ZonePlacementEnvironment;
  readonly trace: ReversibleCellTrace;
  plan: ZoneMutationPlan | null;
}

function definitionForMode(mode: ZoneToolMode): ZoneDefinitionId | null {
  switch (mode) {
    case 'zone-residential':
      return 'residential';
    case 'zone-commercial':
      return 'commercial';
    case 'zone-industrial':
      return 'industrial';
    case 'zone-remove':
      return null;
  }
}

export function createZoneStrokeController(
  options: CreateZoneStrokeControllerOptions,
): ZoneStrokeController {
  let session: ZoneStrokeSession | null = null;

  const clear = (): void => {
    if (session === null) return;
    session = null;
    options.onPreview(null, null, null);
  };

  const replan = (): void => {
    if (session === null) return;
    const definitionId = definitionForMode(session.mode);
    session.plan = planZoneMutation(
      session.zones,
      {
        operation: session.mode === 'zone-remove' ? 'remove' : 'paint',
        definitionId,
        cells: session.trace.cells(),
      },
      session.environment,
      options.config,
    );
    options.onPreview(session.zones, session.plan, session.environment);
  };

  const updateTrace = (cell: CellCoord): void => {
    if (session === null) return;
    if (session.trace.extendTo(cell) || session.plan === null) replan();
  };

  return Object.freeze({
    begin(pointerId: number, cell: CellCoord): boolean {
      const mode = options.getMode();
      if (mode === null || session !== null) return false;
      session = {
        pointerId,
        mode,
        zones: options.getZoneSnapshot(),
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
    end(pointerId: number, cell: CellCoord | null): ZoneMutationPlan | null {
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
    getState(): ZoneInputState {
      const mode = options.getMode();
      return Object.freeze({
        mode,
        strokeActive: session !== null,
        previewValid: session?.plan?.valid ?? null,
        previewCellCount: session?.plan?.requestedCells.length ?? 0,
      });
    },
  });
}
