// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import {
  bindGameToolCancel,
  bindGameToolEvents,
  dispatchGameToolCancel,
  dispatchGameToolEvent,
  dispatchGameTransactionState,
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

  it('delivers committing and undoing transaction states with an explicit domain', () => {
    const target = document.createElement('canvas');
    const listener = vi.fn();
    const controller = new AbortController();
    bindGameToolEvents(target, listener, controller.signal);

    dispatchGameTransactionState(target, 'committing', 'terraform');
    dispatchGameTransactionState(target, 'undoing', 'road');

    expect(listener).toHaveBeenNthCalledWith(
      1,
      Object.freeze({ type: 'transaction-state', state: 'committing', domain: 'terraform' }),
    );
    expect(listener).toHaveBeenNthCalledWith(
      2,
      Object.freeze({ type: 'transaction-state', state: 'undoing', domain: 'road' }),
    );
  });

  it('delivers explicit cancellation independently from presentation events', () => {
    const target = document.createElement('canvas');
    const cancel = vi.fn();
    const presentation = vi.fn();
    const controller = new AbortController();
    bindGameToolCancel(target, cancel, controller.signal);
    bindGameToolEvents(target, presentation, controller.signal);

    dispatchGameToolCancel(target);

    expect(cancel).toHaveBeenCalledOnce();
    expect(presentation).not.toHaveBeenCalled();
  });

  it('stops delivery when the binding signal aborts', () => {
    const target = document.createElement('canvas');
    const listener = vi.fn();
    const cancel = vi.fn();
    const controller = new AbortController();
    bindGameToolEvents(target, listener, controller.signal);
    bindGameToolCancel(target, cancel, controller.signal);
    controller.abort();

    dispatchGameToolEvent(target, DETAIL);
    dispatchGameToolCancel(target);

    expect(listener).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });
});
