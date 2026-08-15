import { describe, expect, it, vi } from 'vitest';
import { renderGameCanvas } from './game-ui.js';

describe('renderGameCanvas', () => {
  it('mounts only the full-bleed canvas, with no legacy dock or panel surface', () => {
    const root = document.createElement('div');
    const host = renderGameCanvas(root);

    expect(host.canvas.id).toBe('game-canvas');
    expect(host.canvas.getAttribute('aria-label')).toBe('City terrain viewport');
    expect(root.querySelector('[data-testid="tool-context"]')).toBeNull();
    expect(root.querySelector('[data-testid="secondary-controls"]')).toBeNull();
    expect(root.querySelector('[data-action]')).toBeNull();
    expect(root.querySelector('.panel')).toBeNull();
  });

  it('measures the canvas viewport in expanded mode on wide screens', () => {
    const root = document.createElement('div');
    root.style.width = '800px';
    root.style.height = '600px';
    const host = renderGameCanvas(root);
    const layout = host.measureViewport();
    expect(layout.width).toBeGreaterThanOrEqual(1);
    expect(layout.height).toBeGreaterThanOrEqual(1);
    expect(layout.mode).toBe('expanded');
    expect(layout.insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('forwards status and undo feeds to subscribed shell listeners', () => {
    const root = document.createElement('div');
    const host = renderGameCanvas(root);
    const onStatus = vi.fn();
    const onUndoAvailable = vi.fn();
    host.onStatus(onStatus);
    host.onUndoAvailable(onUndoAvailable);

    host.setStatus('Terraform applied');
    expect(onStatus).toHaveBeenCalledWith('Terraform applied');

    host.setUndoAvailable(true);
    expect(onUndoAvailable).toHaveBeenCalledWith(true);

    // The feed is a single subscriber slot: re-subscribing replaces the listener.
    const late = vi.fn();
    host.onStatus(late);
    host.setStatus('Loaded');
    expect(late).toHaveBeenCalledWith('Loaded');
    expect(onStatus).not.toHaveBeenCalledWith('Loaded');
  });
});
