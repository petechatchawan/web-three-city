import { afterEach, describe, expect, it, vi } from 'vitest';
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
    ...overrides,
  };
}

function undoButton(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>('[data-testid="tool-context-undo"]');
  if (button === null) throw new Error('tool-context-undo missing');
  return button;
}

function undoPill(): HTMLElement {
  const pill = document.querySelector<HTMLElement>('.city-tool-context-pill');
  if (pill === null) throw new Error('undo pill missing');
  return pill;
}

describe('tool context sheet', () => {
  it('renders name, state, message, metrics, affordability, and Undo without blocking the world', () => {
    const sheet = mountToolContextSheet(document.body);
    sheet.update(projection());
    sheet.setUndoAvailable(true);
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
    expect(element.querySelector('[data-city-icon="roads"]')).not.toBeNull();
    const undo = undoButton();
    expect(undo.classList.contains('city-icon-button')).toBe(true);
    expect(undo.getAttribute('aria-label')).toBe('Undo latest world change');
  });

  it('collapses and expands the body via the toggle', () => {
    const sheet = mountToolContextSheet(document.body);
    sheet.update(projection());
    const toggle = document.querySelector<HTMLButtonElement>('[data-testid="tool-context-toggle"]');
    const content = document.querySelector<HTMLElement>('[data-testid="tool-context-content"]');
    expect(toggle).not.toBeNull();
    expect(content).not.toBeNull();
    expect(toggle!.classList.contains('city-icon-button')).toBe(true);
    expect(toggle!.querySelector('[data-city-icon]')).not.toBeNull();
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
    });
    const text = sheet.element.textContent ?? '';
    expect(text).toContain('Undo unavailable');
    expect(text).not.toContain('cells');
    expect(text).not.toContain('effective');
    expect(text).not.toContain('Afford');
  });

  it('wires the Undo button to onUndo and enables it only when undo is available', () => {
    const onUndo = vi.fn();
    const sheet = mountToolContextSheet(document.body, { onUndo });
    sheet.update(projection());
    expect(undoButton().disabled).toBe(true);
    undoButton().click();
    expect(onUndo).not.toHaveBeenCalled();
    sheet.setUndoAvailable(true);
    expect(undoButton().disabled).toBe(false);
    undoButton().click();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('keeps setUndoAvailable in sync across re-renders', () => {
    const sheet = mountToolContextSheet(document.body);
    sheet.update(projection());
    sheet.setUndoAvailable(true);
    expect(undoButton().disabled).toBe(false);
    expect(undoPill().textContent).toBe('Undo available');
    sheet.update(projection());
    expect(undoButton().disabled).toBe(false);
    expect(undoPill().textContent).toBe('Undo available');
    sheet.setUndoAvailable(false);
    expect(undoButton().disabled).toBe(true);
    expect(undoPill().textContent).toBe('Undo unavailable');
  });

  it('keeps the latest transient status visible across tool projections and renders the message testid', () => {
    const sheet = mountToolContextSheet(document.body);
    sheet.setStatus('Saved');
    expect(sheet.element.textContent).toContain('Saved');
    sheet.update(projection());
    expect(sheet.element.textContent).toContain('Saved');
    expect(document.querySelector('[data-testid="tool-context-message"]')?.textContent).toBe(
      'Insufficient funds',
    );
    sheet.setStatus('Loaded');
    expect(document.querySelector('[data-testid="tool-context-status"]')?.textContent).toBe(
      'Loaded',
    );
  });

  it('resets a transient Applying change state to Ready when a completion status arrives', () => {
    const sheet = mountToolContextSheet(document.body);
    sheet.update({
      mode: 'road-build',
      name: 'Build Road',
      state: 'Applying change',
      message: 'Applying Road change…',
    });
    expect(document.querySelector('[data-testid="tool-context-state"]')?.textContent).toBe(
      'Applying change',
    );
    sheet.setStatus('Road built');
    expect(document.querySelector('[data-testid="tool-context-state"]')?.textContent).toBe('Ready');
    expect(document.querySelector('[data-testid="tool-context-status"]')?.textContent).toBe(
      'Road built',
    );
  });

  it('keeps a rejection state intact when its status arrives', () => {
    const sheet = mountToolContextSheet(document.body);
    sheet.update(projection());
    expect(document.querySelector('[data-testid="tool-context-state"]')?.textContent).toBe(
      'Rejected',
    );
    sheet.setStatus('Road blocked by water');
    expect(document.querySelector('[data-testid="tool-context-state"]')?.textContent).toBe(
      'Rejected',
    );
  });
});
