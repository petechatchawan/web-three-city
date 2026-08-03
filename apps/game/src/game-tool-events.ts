import type { ZoneInvalidReason } from '@web-three-city/zone-core';
import type { GameOperationReason } from './game-reason-catalog.js';
import type { GameRoadInvalidReason } from './road-zone-guard.js';
import type { RoadInputState } from './road-stroke-controller.js';
import type { TerraformStrokeSessionState } from './terraform-stroke-session.js';
import type { ZoneInputState } from './zone-stroke-controller.js';

export const GAME_TOOL_EVENT = 'web-three-city:game-tool-presentation';
export const GAME_TOOL_CANCEL_EVENT = 'web-three-city:cancel-tool-session';

export type GameTransactionState = 'committing' | 'undoing';
export type GameTransactionDomain = 'terraform' | 'road' | 'zone' | 'building';

export type GameToolEventDetail =
  | { readonly type: 'terraform-state'; readonly state: TerraformStrokeSessionState }
  | {
      readonly type: 'road-state';
      readonly state: RoadInputState;
      readonly reason: GameRoadInvalidReason | null;
    }
  | {
      readonly type: 'zone-state';
      readonly state: ZoneInputState;
      readonly reason: ZoneInvalidReason | null;
      readonly effectiveCellCount: number;
      readonly invalidCellCount: number;
    }
  | { readonly type: 'reason'; readonly reason: GameOperationReason }
  | {
      readonly type: 'transaction-state';
      readonly state: GameTransactionState;
      readonly domain: GameTransactionDomain;
    };

export function dispatchGameToolEvent(target: EventTarget, detail: GameToolEventDetail): void {
  target.dispatchEvent(new CustomEvent<GameToolEventDetail>(GAME_TOOL_EVENT, { detail }));
}

export function dispatchGameTransactionState(
  target: EventTarget,
  state: GameTransactionState,
  domain: GameTransactionDomain,
): void {
  dispatchGameToolEvent(target, Object.freeze({ type: 'transaction-state', state, domain }));
}

export function bindGameToolEvents(
  target: EventTarget,
  listener: (detail: GameToolEventDetail) => void,
  signal?: AbortSignal,
): void {
  target.addEventListener(
    GAME_TOOL_EVENT,
    (event) => listener((event as CustomEvent<GameToolEventDetail>).detail),
    signal === undefined ? undefined : { signal },
  );
}

export function dispatchGameToolCancel(target: EventTarget): void {
  target.dispatchEvent(new Event(GAME_TOOL_CANCEL_EVENT));
}

export function bindGameToolCancel(
  target: EventTarget,
  listener: () => void,
  signal?: AbortSignal,
): void {
  target.addEventListener(
    GAME_TOOL_CANCEL_EVENT,
    listener,
    signal === undefined ? undefined : { signal },
  );
}
