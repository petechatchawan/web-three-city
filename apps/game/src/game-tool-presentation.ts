import type { TerraformBrushSize } from '@web-three-city/terrain-core';
import type { GameZoneInvalidReason } from './zone-building-guard.js';
import type { GameOperationReason } from './game-reason-catalog.js';
import type { GameToolMode } from './game-tool-mode.js';
import type { RoadInputState } from './road-stroke-controller.js';
import type { TerraformStrokeSessionState } from './terraform-stroke-session.js';
import type { ZoneInputState } from './zone-stroke-controller.js';

export type GameTransactionDomain = 'terraform' | 'road' | 'zone' | 'building';

export type GameToolInteractionState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'terraform'; readonly state: TerraformStrokeSessionState }
  | {
      readonly kind: 'road';
      readonly state: RoadInputState;
      readonly reason: GameOperationReason | null;
    }
  | {
      readonly kind: 'zone';
      readonly state: ZoneInputState;
      readonly reason: GameZoneInvalidReason | null;
      readonly effectiveCellCount: number;
      readonly invalidCellCount: number;
    }
  | { readonly kind: 'committing'; readonly domain: GameTransactionDomain }
  | { readonly kind: 'undoing' }
  | { readonly kind: 'blocking-recovery'; readonly message: string };

export interface GameToolPresentationState {
  readonly mode: GameToolMode;
  readonly storedTerraformBrush: TerraformBrushSize;
  readonly interaction: GameToolInteractionState;
  readonly undoAvailable: boolean;
  readonly primaryMessage: string | null;
}

export type GameToolPresentationAction =
  | { readonly type: 'select-tool'; readonly mode: GameToolMode }
  | { readonly type: 'select-brush'; readonly size: TerraformBrushSize }
  | { readonly type: 'close-tool' }
  | { readonly type: 'terraform-state'; readonly state: TerraformStrokeSessionState }
  | {
      readonly type: 'road-state';
      readonly state: RoadInputState;
      readonly reason: GameOperationReason | null;
    }
  | {
      readonly type: 'zone-state';
      readonly state: ZoneInputState;
      readonly reason: GameZoneInvalidReason | null;
      readonly effectiveCellCount: number;
      readonly invalidCellCount: number;
    }
  | { readonly type: 'set-undo-available'; readonly available: boolean }
  | { readonly type: 'set-message'; readonly message: string | null }
  | { readonly type: 'set-committing'; readonly domain: GameTransactionDomain }
  | { readonly type: 'set-undoing' }
  | { readonly type: 'set-blocking-recovery'; readonly message: string }
  | { readonly type: 'set-idle' };

const IDLE_INTERACTION: GameToolInteractionState = Object.freeze({ kind: 'idle' });

function frozenState(
  state: Omit<GameToolPresentationState, 'interaction'> & {
    readonly interaction: GameToolInteractionState;
  },
): GameToolPresentationState {
  return Object.freeze({ ...state, interaction: Object.freeze(state.interaction) });
}

export function initialGameToolPresentationState(): GameToolPresentationState {
  return frozenState({
    mode: 'navigate',
    storedTerraformBrush: 1,
    interaction: IDLE_INTERACTION,
    undoAvailable: false,
    primaryMessage: null,
  });
}

export function reduceGameToolPresentation(
  state: GameToolPresentationState,
  action: GameToolPresentationAction,
): GameToolPresentationState {
  switch (action.type) {
    case 'select-tool':
      return frozenState({
        ...state,
        mode: action.mode,
        interaction: IDLE_INTERACTION,
        primaryMessage: null,
      });
    case 'select-brush':
      return frozenState({ ...state, storedTerraformBrush: action.size });
    case 'close-tool':
      return frozenState({
        ...state,
        mode: 'navigate',
        interaction: IDLE_INTERACTION,
        primaryMessage: null,
      });
    case 'terraform-state':
      return frozenState({
        ...state,
        mode: action.state.operation ?? state.mode,
        storedTerraformBrush: action.state.brushSize,
        interaction: { kind: 'terraform', state: action.state },
      });
    case 'road-state':
      return frozenState({
        ...state,
        mode: action.state.mode ?? state.mode,
        interaction: { kind: 'road', state: action.state, reason: action.reason },
      });
    case 'zone-state':
      return frozenState({
        ...state,
        mode: action.state.mode ?? state.mode,
        interaction: {
          kind: 'zone',
          state: action.state,
          reason: action.reason,
          effectiveCellCount: action.effectiveCellCount,
          invalidCellCount: action.invalidCellCount,
        },
      });
    case 'set-undo-available':
      return frozenState({ ...state, undoAvailable: action.available });
    case 'set-message':
      return frozenState({ ...state, primaryMessage: action.message });
    case 'set-committing':
      return frozenState({
        ...state,
        interaction: { kind: 'committing', domain: action.domain },
        undoAvailable: false,
      });
    case 'set-undoing':
      return frozenState({ ...state, interaction: { kind: 'undoing' }, undoAvailable: false });
    case 'set-blocking-recovery':
      return frozenState({
        ...state,
        interaction: { kind: 'blocking-recovery', message: action.message },
        undoAvailable: false,
        primaryMessage: action.message,
      });
    case 'set-idle':
      return frozenState({ ...state, interaction: IDLE_INTERACTION });
  }
}
