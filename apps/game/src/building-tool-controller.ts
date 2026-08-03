import type { CellCoord } from '@web-three-city/world-core';
import type { BuildingToolMode } from './game-tool-mode.js';

export interface BuildingToolRequest {
  readonly mode: BuildingToolMode;
  readonly cell: CellCoord;
}
export interface BuildingInputState {
  readonly mode: BuildingToolMode | null;
  readonly strokeActive: boolean;
  readonly cell: CellCoord | null;
}
export interface BuildingToolController {
  begin(pointerId: number, cell: CellCoord): boolean;
  move(pointerId: number, cell: CellCoord): void;
  end(pointerId: number, cell: CellCoord | null): BuildingToolRequest | null;
  cancel(pointerId: number): void;
  cancelAll(): void;
  getState(): BuildingInputState;
}

export function createBuildingToolController(getMode: () => BuildingToolMode | null): BuildingToolController {
  let activePointer: number | null = null;
  let activeCell: CellCoord | null = null;
  const state = (): BuildingInputState => Object.freeze({ mode: getMode(), strokeActive: activePointer !== null, cell: activeCell === null ? null : Object.freeze({ ...activeCell }) });
  return {
    begin(pointerId, cell) {
      if (getMode() === null || activePointer !== null) return false;
      activePointer = pointerId;
      activeCell = Object.freeze({ ...cell });
      return true;
    },
    move(pointerId, cell) {
      if (activePointer === pointerId) activeCell = Object.freeze({ ...cell });
    },
    end(pointerId, cell) {
      if (activePointer !== pointerId) return null;
      const mode = getMode();
      const selected = cell ?? activeCell;
      activePointer = null;
      activeCell = null;
      return mode === null || selected === null ? null : Object.freeze({ mode, cell: Object.freeze({ ...selected }) });
    },
    cancel(pointerId) { if (activePointer === pointerId) { activePointer = null; activeCell = null; } },
    cancelAll() { activePointer = null; activeCell = null; },
    getState: state,
  };
}
