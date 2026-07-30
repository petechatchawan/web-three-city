// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { bindGameToolCancel } from './game-tool-events.js';
import { bindGameToolHud } from './game-tool-hud-binding.js';
import { renderGameUi } from './game-ui.js';

function flushMutationObserver(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

describe('Game HUD recovery fencing', () => {
  it('cancels mutation mode, blocks tools, and re-enables them after Load succeeds', async () => {
    const root = document.createElement('div');
    const ui = renderGameUi(root);
    const controller = new AbortController();
    const cancel = vi.fn();
    bindGameToolCancel(ui.canvas, cancel, controller.signal);
    bindGameToolHud(root, ui.canvas, controller.signal);
    ui.navigateButton.addEventListener('click', () => ui.setToolMode('navigate'));
    ui.setToolMode('raise');

    ui.setStatus('World update failed');
    await flushMutationObserver();

    expect(cancel).toHaveBeenCalledOnce();
    expect(root.querySelector('[data-testid="active-tool"]')?.textContent).toBe('Navigate');
    expect(ui.raiseButton.disabled).toBe(true);
    expect(ui.lowerButton.disabled).toBe(true);
    expect(ui.flattenButton.disabled).toBe(true);
    expect(ui.roadBuildButton.disabled).toBe(true);
    expect(ui.roadBulldozeButton.disabled).toBe(true);
    expect(ui.undoButton.disabled).toBe(true);
    expect(ui.saveButton.disabled).toBe(false);
    expect(ui.loadButton.disabled).toBe(false);

    ui.setStatus('Loaded');
    await flushMutationObserver();

    expect(ui.raiseButton.disabled).toBe(false);
    expect(ui.lowerButton.disabled).toBe(false);
    expect(ui.flattenButton.disabled).toBe(false);
    expect(ui.roadBuildButton.disabled).toBe(false);
    expect(ui.roadBulldozeButton.disabled).toBe(false);
    controller.abort();
  });
});
