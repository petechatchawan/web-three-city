import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContextualToolProjection } from './status-feedback.js';
import { mountStatusFeedback } from './status-feedback.js';

afterEach(() => document.body.replaceChildren());

function projection(overrides: Partial<ContextualToolProjection> = {}): ContextualToolProjection {
  return {
    mode: 'road-build',
    name: 'Build Road',
    state: 'Ready',
    message: 'Point at the world to preview this tool',
    requestedCells: 4,
    effectiveCells: 4,
    affordability: 'Affordable',
    ...overrides,
  };
}

function toggle(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('[data-testid="tool-context-toggle"]');
}

function undo(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('[data-testid="tool-context-undo"]');
}

describe('M6.3 Figma contextual tool sheet', () => {
  it('stays hidden in Navigate mode', () => {
    const sheet = mountStatusFeedback(document.body);
    sheet.update(projection({ mode: 'navigate', name: 'Navigate' }));
    expect(sheet.element.hidden).toBe(true);
  });

  it('shows active tool name and Ready state in a collapsed sheet without routine helper copy', () => {
    const sheet = mountStatusFeedback(document.body);
    sheet.update(projection());
    expect(sheet.element.hidden).toBe(false);
    expect(sheet.element.dataset.expanded).toBe('false');
    expect(sheet.element.textContent).toContain('Build Road');
    expect(sheet.element.textContent).toContain('Ready');
    expect(sheet.element.textContent).not.toContain('Point at the world to preview this tool');
    expect(toggle()).not.toBeNull();
  });

  it('expands authoritative requested, effective, and affordability metadata on demand', () => {
    const sheet = mountStatusFeedback(document.body);
    sheet.update(projection());
    toggle()?.click();
    expect(sheet.element.dataset.expanded).toBe('true');
    expect(sheet.element.textContent).toContain('Requested cells');
    expect(sheet.element.textContent).toContain('4');
    expect(sheet.element.textContent).toContain('Effective cells');
    expect(sheet.element.textContent).toContain('Affordable');
  });

  it('shows rejection and invalid messages as contextual validation', () => {
    const sheet = mountStatusFeedback(document.body);
    sheet.update(
      projection({
        state: 'Rejected',
        message: 'Insufficient funds',
        affordability: 'Unaffordable',
      }),
    );
    expect(sheet.element.textContent).toContain('Rejected');
    expect(sheet.element.textContent).toContain('Insufficient funds');
    sheet.update(projection({ state: 'Invalid build', message: 'Road blocked by water' }));
    expect(sheet.element.textContent).toContain('Road blocked by water');
  });

  it('keeps Undo inside expanded disclosure and only enables it when authority allows', () => {
    const sheet = mountStatusFeedback(document.body, { onUndo: vi.fn() });
    sheet.update(projection());
    sheet.setUndoAvailable(true);
    expect(undo()).toBeNull();
    toggle()?.click();
    expect(undo()).not.toBeNull();
    expect(undo()?.disabled).toBe(false);
  });

  it('wires expanded Undo to the existing Undo authority', () => {
    const onUndo = vi.fn();
    const sheet = mountStatusFeedback(document.body, { onUndo });
    sheet.update(projection());
    sheet.setUndoAvailable(true);
    toggle()?.click();
    undo()?.click();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('allows host completion status to override then clear back to the current tool projection', () => {
    const sheet = mountStatusFeedback(document.body);
    sheet.update(projection());
    sheet.setStatus('Road built');
    expect(sheet.element.textContent).toContain('Road built');
    sheet.clearStatus();
    expect(sheet.element.textContent).not.toContain('Road built');
    expect(sheet.element.textContent).toContain('Build Road');
    expect(sheet.element.textContent).toContain('Ready');
  });

  it('does not create a context surface from host Ready before an active tool exists', () => {
    const sheet = mountStatusFeedback(document.body);
    sheet.setStatus('Ready');
    expect(sheet.element.hidden).toBe(true);
    expect(sheet.element.textContent).not.toContain('Ready');
  });
});
