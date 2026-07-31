// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { expandGameSecondaryControls } from './game-secondary-controls.js';
import { renderGameUi } from './game-ui.js';

describe('expandGameSecondaryControls', () => {
  it('opens persistence and camera controls for immediate application access', () => {
    const root = document.createElement('div');
    renderGameUi(root);
    const details = root.querySelector<HTMLDetailsElement>(
      '[data-testid="secondary-controls"]',
    );
    expect(details?.open).toBe(false);

    const expanded = expandGameSecondaryControls(root);

    expect(expanded).toBe(details);
    expect(expanded.open).toBe(true);
    expect(root.querySelector('[data-action="save"]')).not.toBeNull();
    expect(root.querySelector('[data-action="load"]')).not.toBeNull();
  });

  it('fails fast when the application shell is incomplete', () => {
    expect(() => expandGameSecondaryControls(document.createElement('div'))).toThrow(
      'game:missing-secondary-controls',
    );
  });
});
