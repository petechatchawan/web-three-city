// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import {
  bindGameToolEvents,
  dispatchGameToolEvent,
  type GameToolEventDetail,
} from './game-tool-events.js';

const DETAIL: GameToolEventDetail = Object.freeze({
  type: 'reason',
  reason: 'terraform:road-occupied',
});

describe('Game tool presentation events', () => {
  it('delivers immutable typed detail to the bound target', () => {
    const target = document.createElement('canvas');
    const listener = vi.fn();
    const controller = new AbortController();
    bindGameToolEvents(target, listener, controller.signal);

    dispatchGameToolEvent(target, DETAIL);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(DETAIL);
    expect(Object.isFrozen(DETAIL)).toBe(true);
  });

  it('stops delivery when the binding signal aborts', () => {
    const target = document.createElement('canvas');
    const listener = vi.fn();
    const controller = new AbortController();
    bindGameToolEvents(target, listener, controller.signal);
    controller.abort();

    dispatchGameToolEvent(target, DETAIL);

    expect(listener).not.toHaveBeenCalled();
  });
});
