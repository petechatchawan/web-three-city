import { afterEach, describe, expect, it } from 'vitest';
import { mountToolContextSheet, type ContextualToolProjection } from './tool-context-sheet.js';

afterEach(() => document.body.replaceChildren());

function projection(overrides: Partial<ContextualToolProjection> = {}): ContextualToolProjection {
  return {
    mode: 'road-build',
    name: 'Build Road',
    state: 'Rejected',
    message: 'Insufficient funds',
    requestedCells: 4,
    effectiveCells: 0,
    affordability: 'Unaffordable',
    undoAvailable: true,
    ...overrides,
  };
}

describe('tool context sheet', () => {
  it('renders name, state, message, metrics, affordability, and Undo without blocking the world', () => {
    const sheet = mountToolContextSheet(document.body);
    sheet.update(projection());
    const element = sheet.element;
    expect(element.classList.contains('city-tool-context')).toBe(true);
    expect(element.getAttribute('aria-label')).toBe('Active tool');
    expect(element.hasAttribute('data-world-input-block')).toBe(false);
    expect(element.textContent).toContain('Build Road');
    expect(element.textContent).toContain('Rejected');
    expect(element.textContent).toContain('Insufficient funds');
    expect(element.textContent).toContain('4 cells');
    expect(element.textContent).toContain('0 effective');
    expect(element.textContent).toContain('Unaffordable');
    expect(element.textContent).toContain('Undo available');
  });

  it('collapses and expands the body via the toggle', () => {
    const sheet = mountToolContextSheet(document.body);
    sheet.update(projection({ undoAvailable: false }));
    const toggle = document.querySelector<HTMLButtonElement>('[data-testid="tool-context-toggle"]');
    const content = document.querySelector<HTMLElement>('[data-testid="tool-context-content"]');
    expect(toggle).not.toBeNull();
    expect(content).not.toBeNull();
    expect(toggle!.getAttribute('aria-expanded')).toBe('true');
    expect(content!.hasAttribute('hidden')).toBe(false);
    toggle!.click();
    expect(toggle!.getAttribute('aria-expanded')).toBe('false');
    expect(content!.hasAttribute('hidden')).toBe(true);
    toggle!.click();
    expect(toggle!.getAttribute('aria-expanded')).toBe('true');
    expect(content!.hasAttribute('hidden')).toBe(false);
  });

  it('omits metric chips and affordability when absent, and renders unavailable Undo', () => {
    const sheet = mountToolContextSheet(document.body);
    sheet.update({
      mode: 'road-build',
      name: 'Build Road',
      state: 'Rejected',
      message: 'Insufficient funds',
      undoAvailable: false,
    });
    const text = sheet.element.textContent ?? '';
    expect(text).toContain('Undo unavailable');
    expect(text).not.toContain('cells');
    expect(text).not.toContain('effective');
    expect(text).not.toContain('Afford');
  });
});
