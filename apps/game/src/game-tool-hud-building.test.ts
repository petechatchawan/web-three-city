// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { dispatchGameToolEvent } from './game-tool-events.js';
import { bindGameToolHud } from './game-tool-hud-binding.js';
import { renderGameUi } from './game-ui.js';

describe('Building-aware Game Tool HUD', () => {
  it('surfaces a stable Terraform blocked-by-Building status', () => {
    const root = document.createElement('div');
    const ui = renderGameUi(root);
    const controller = new AbortController();
    bindGameToolHud(root, ui.canvas, controller.signal);

    dispatchGameToolEvent(
      ui.canvas,
      Object.freeze({ type: 'reason', reason: 'terraform:building-occupied' }),
    );

    expect(ui.status.textContent).toBe('Terraform blocked by building');
    expect(root.querySelector('[data-testid="tool-context-state"]')?.textContent).toBe('Rejected');
    expect(root.querySelector('[data-testid="tool-context-message"]')?.textContent).toBe(
      'Bulldoze the building before changing this terrain',
    );
  });

  it('labels Building commit and Undo transaction ownership', () => {
    const root = document.createElement('div');
    const ui = renderGameUi(root);
    const controller = new AbortController();
    bindGameToolHud(root, ui.canvas, controller.signal);

    dispatchGameToolEvent(
      ui.canvas,
      Object.freeze({ type: 'transaction-state', state: 'committing', domain: 'building' }),
    );
    expect(root.querySelector('[data-testid="tool-context-message"]')?.textContent).toBe(
      'Applying Building change…',
    );

    dispatchGameToolEvent(
      ui.canvas,
      Object.freeze({ type: 'transaction-state', state: 'undoing', domain: 'building' }),
    );
    expect(root.querySelector('[data-testid="tool-context-message"]')?.textContent).toBe(
      'Restoring previous Building state…',
    );
  });
});
