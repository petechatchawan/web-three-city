import { afterEach, describe, expect, it } from 'vitest';
import { mountContextualToolSurface } from './contextual-tool-surface.js';

afterEach(() => document.body.replaceChildren());

describe('contextual tool surface', () => {
  it('renders validity, rejection, affordability, and Undo without blocking the remaining world', () => {
    const surface = mountContextualToolSurface(document.body);
    surface.update({
      mode: 'road-build',
      name: 'Build Road',
      state: 'Invalid',
      message: 'Insufficient funds',
      requestedCells: 4,
      effectiveCells: 0,
      affordability: 'Unaffordable',
      undoAvailable: true,
    });
    expect(surface.element.hasAttribute('data-world-input-block')).toBe(false);
    expect(surface.element.textContent).toContain('Insufficient funds');
    expect(surface.element.textContent).toContain('Unaffordable');
    expect(surface.element.textContent).toContain('Undo available');
  });
});
