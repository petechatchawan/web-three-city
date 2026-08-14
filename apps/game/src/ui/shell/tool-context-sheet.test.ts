import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContextualToolProjection } from './status-feedback.js';
import { mountStatusFeedback } from './status-feedback.js';

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

function feedbackButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('[data-testid="tool-context-undo"]');
}

describe('M6.2 transient status feedback', () => {
  it('reserves no permanent map space while idle', () => {
    const feedback = mountStatusFeedback(document.body);
    expect(feedback.element.classList.contains('city-status-feedback')).toBe(true);
    expect(feedback.element.hidden).toBe(true);
    expect(feedback.element.textContent).not.toContain('Ready');
    expect(feedback.element.textContent).not.toContain('Point at the world');
    expect(feedback.element.textContent).not.toContain('Undo unavailable');
  });

  it('shows host completion status as compact feedback', () => {
    const feedback = mountStatusFeedback(document.body);
    feedback.setStatus('Road built');
    expect(feedback.element.hidden).toBe(false);
    expect(feedback.element.querySelector('[data-testid="tool-context-status"]')?.textContent).toBe(
      'Road built',
    );
  });

  it('shows rejected tool projections but ignores default tool-ready projection', () => {
    const feedback = mountStatusFeedback(document.body);
    feedback.update(
      projection({ state: 'Tool ready', message: 'Point at the world to preview this tool' }),
    );
    expect(feedback.element.hidden).toBe(true);
    feedback.update(projection());
    expect(feedback.element.hidden).toBe(false);
    expect(feedback.element.textContent).toContain('Insufficient funds');
  });

  it('shows invalid and no-change feedback as meaningful events', () => {
    const feedback = mountStatusFeedback(document.body);
    feedback.update(projection({ state: 'Invalid build', message: 'Road blocked by water' }));
    expect(feedback.element.textContent).toContain('Road blocked by water');
    feedback.update(projection({ state: 'No change', message: 'No terrain change' }));
    expect(feedback.element.textContent).toContain('No terrain change');
  });

  it('shows Undo only when Undo is available', () => {
    const feedback = mountStatusFeedback(document.body, { onUndo: vi.fn() });
    feedback.setStatus('Road built');
    feedback.setUndoAvailable(false);
    expect(feedbackButton()).toBeNull();
    feedback.setUndoAvailable(true);
    expect(feedbackButton()).not.toBeNull();
    expect(feedbackButton()?.disabled).toBe(false);
  });

  it('wires the compact Undo action to the existing Undo authority', () => {
    const onUndo = vi.fn();
    const feedback = mountStatusFeedback(document.body, { onUndo });
    feedback.setUndoAvailable(true);
    feedbackButton()?.click();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('clearStatus hides feedback when Undo is unavailable', () => {
    const feedback = mountStatusFeedback(document.body);
    feedback.setStatus('Saved');
    feedback.clearStatus();
    expect(feedback.element.hidden).toBe(true);
    expect(feedback.element.textContent).not.toContain('Saved');
  });

  it('clearStatus preserves a compact surface while Undo remains available', () => {
    const feedback = mountStatusFeedback(document.body, { onUndo: vi.fn() });
    feedback.setStatus('Road built');
    feedback.setUndoAvailable(true);
    feedback.clearStatus();
    expect(feedback.element.hidden).toBe(false);
    expect(feedbackButton()).not.toBeNull();
    expect(feedback.element.textContent).not.toContain('Road built');
  });
});
