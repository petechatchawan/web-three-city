// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { dispatchGameToolEvent } from './game-tool-events.js';
import { bindGameToolHud } from './game-tool-hud-binding.js';
import { renderGameUi } from './game-ui.js';

function flushMutationObserver(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

describe('bindGameToolHud', () => {
  it('renders live Terraform counts and rejection copy', () => {
    const root = document.createElement('div');
    const ui = renderGameUi(root);
    const controller = new AbortController();
    bindGameToolHud(root, ui.canvas, controller.signal);

    dispatchGameToolEvent(
      ui.canvas,
      Object.freeze({
        type: 'terraform-state',
        state: Object.freeze({
          operation: 'raise',
          brushSize: 3,
          strokeActive: true,
          flattenTargetLevel: null,
          acceptedAnchors: Object.freeze([
            { x: 1, z: 1 },
            { x: 2, z: 1 },
          ]),
          acceptedPlan: Object.freeze({ supportCells: Object.freeze([{ x: 3, z: 1 }]) }) as never,
          currentStamp: Object.freeze({
            kind: 'rejected',
            anchor: Object.freeze({ x: 4, z: 1 }),
            reason: 'terraform:road-occupied',
            preview: Object.freeze({}) as never,
          }),
        }),
      }),
    );

    expect(root.querySelector('[data-testid="terraform-accepted-count"]')?.textContent).toBe('2');
    expect(root.querySelector('[data-testid="terraform-support-count"]')?.textContent).toBe('1');
    expect(root.querySelector('[data-testid="tool-context-state"]')?.textContent).toBe('Rejected');
    expect(root.querySelector('[data-testid="tool-context-message"]')?.textContent).toBe(
      'Remove the road before changing this terrain',
    );
  });

  it('renders Road counts and a stable invalid reason', () => {
    const root = document.createElement('div');
    const ui = renderGameUi(root);
    const controller = new AbortController();
    bindGameToolHud(root, ui.canvas, controller.signal);

    dispatchGameToolEvent(
      ui.canvas,
      Object.freeze({
        type: 'road-state',
        state: Object.freeze({
          mode: 'road-build',
          strokeActive: true,
          previewValid: false,
          previewCellCount: 4,
        }),
        reason: 'road:wet-cell',
      }),
    );

    expect(root.querySelector('[data-testid="road-requested-count"]')?.textContent).toBe('4');
    expect(root.querySelector('[data-testid="road-effective-count"]')?.textContent).toBe('0');
    expect(root.querySelector('[data-testid="tool-context-message"]')?.textContent).toBe(
      'Roads cannot be placed on water',
    );
  });

  it('mirrors completed and recovery status after a session ends', async () => {
    const root = document.createElement('div');
    const ui = renderGameUi(root);
    const controller = new AbortController();
    bindGameToolHud(root, ui.canvas, controller.signal);

    ui.setStatus('Terraform applied');
    await flushMutationObserver();
    expect(root.querySelector('[data-testid="tool-context-state"]')?.textContent).toBe('Ready');
    expect(root.querySelector('[data-testid="tool-context-message"]')?.textContent).toBe(
      'Terraform applied',
    );

    ui.setStatus('World update failed');
    await flushMutationObserver();
    expect(root.querySelector('[data-testid="tool-context-state"]')?.textContent).toBe(
      'Recovery required',
    );
  });
});
