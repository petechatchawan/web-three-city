// @vitest-environment happy-dom

import type { TerraformBrushSize } from '@web-three-city/terrain-core';
import { describe, expect, it, vi } from 'vitest';
import {
  bindGameKeyboardShortcuts,
  type GameKeyboardActions,
} from './game-keyboard-shortcuts.js';

function fakeActions(initialBrush: TerraformBrushSize = 1): GameKeyboardActions {
  let brush = initialBrush;
  const selectBrush = vi.fn((next: TerraformBrushSize) => {
    brush = next;
  });
  return {
    selectTool: vi.fn(),
    getBrush: () => brush,
    selectBrush,
    requestUndo: vi.fn(),
    cancelPreviewOrCloseTool: vi.fn(),
  };
}

function dispatchKey(
  target: EventTarget,
  key: string,
  actions: GameKeyboardActions,
  options: Readonly<{ ctrlKey?: boolean; metaKey?: boolean }> = {},
): KeyboardEvent {
  const controller = new AbortController();
  bindGameKeyboardShortcuts(window, actions, controller.signal);
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
  });
  target.dispatchEvent(event);
  controller.abort();
  return event;
}

describe('bindGameKeyboardShortcuts', () => {
  it.each([
    ['1', 'raise'],
    ['2', 'lower'],
    ['3', 'flatten'],
    ['4', 'road-build'],
    ['5', 'road-bulldoze'],
  ] as const)('maps %s to %s', (key, mode) => {
    const actions = fakeActions();

    dispatchKey(document.body, key, actions);

    expect(actions.selectTool).toHaveBeenCalledWith(mode);
  });

  it('does not fire tool shortcuts from editable or select controls', () => {
    const actions = fakeActions();
    const input = document.createElement('input');
    const select = document.createElement('select');
    document.body.append(input, select);

    dispatchKey(input, '1', actions);
    dispatchKey(select, '2', actions);

    expect(actions.selectTool).not.toHaveBeenCalled();
  });

  it('Escape routes to cancel-preview-before-close ownership', () => {
    const actions = fakeActions();

    const event = dispatchKey(document.body, 'Escape', actions);

    expect(actions.cancelPreviewOrCloseTool).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('routes Ctrl/Cmd+Z to the latest-world-change Undo action', () => {
    const actions = fakeActions();

    dispatchKey(document.body, 'z', actions, { ctrlKey: true });
    dispatchKey(document.body, 'z', actions, { metaKey: true });

    expect(actions.requestUndo).toHaveBeenCalledTimes(2);
  });

  it('cycles Terraform brush shortcuts from the current pointer-selected brush', () => {
    const actions = fakeActions(5);
    const controller = new AbortController();
    bindGameKeyboardShortcuts(window, actions, controller.signal);

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '[', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '[', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ']', bubbles: true }));
    controller.abort();

    expect(actions.selectBrush).toHaveBeenNthCalledWith(1, 3);
    expect(actions.selectBrush).toHaveBeenNthCalledWith(2, 1);
    expect(actions.selectBrush).toHaveBeenNthCalledWith(3, 3);
  });
});
