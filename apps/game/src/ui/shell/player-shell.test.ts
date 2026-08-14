import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPlayerShell } from './player-shell.js';

afterEach(() => document.body.replaceChildren());

describe('player shell M6.3 Figma mobile state model', () => {
  it('uses persistent Figma bottom navigation and keeps Tool Context synchronized with active category', () => {
    const selectTool = vi.fn();
    const shell = mountPlayerShell(document.body, {
      onInformationViews: vi.fn(),
      onCity: vi.fn(),
      onGameMenu: vi.fn(),
      setSpeed: vi.fn(),
      step: vi.fn(),
      selectTool,
      setTerraformBrush: vi.fn(),
      onSelectMetric: vi.fn(),
      onUndo: vi.fn(),
    });

    expect(shell.element.querySelector('.city-bottom-nav')).not.toBeNull();
    expect(shell.element.querySelector('[data-testid="primary-navigate"]')).toBeNull();
    expect(shell.element.querySelector('[data-testid="build-cta"]')).toBeNull();
    expect(shell.element.querySelector('.city-build-category-dock')).toBeNull();
    expect(shell.subToolTray.element.hasAttribute('hidden')).toBe(true);
    expect(shell.toolContextSheet.element.hidden).toBe(true);

    const terrain = shell.element.querySelector<HTMLButtonElement>('[data-testid="nav-terrain"]');
    terrain?.click();
    expect(selectTool).toHaveBeenLastCalledWith('raise');
    expect(terrain?.getAttribute('aria-pressed')).toBe('true');
    expect(shell.subToolTray.element.hasAttribute('hidden')).toBe(false);
    expect(shell.subToolTray.element.querySelectorAll('[data-tool-mode]').length).toBe(3);
    expect(shell.subToolTray.element.querySelectorAll('[data-brush-size]').length).toBe(3);
    expect(shell.toolContextSheet.element.hidden).toBe(false);
    expect(shell.toolContextSheet.element.textContent).toContain('Raise');

    const lower = shell.subToolTray.element.querySelector<HTMLButtonElement>(
      '[data-tool-mode="lower"]',
    );
    lower?.click();
    expect(selectTool).toHaveBeenLastCalledWith('lower');
    expect(shell.toolContextSheet.element.textContent).toContain('Lower');

    terrain?.click();
    expect(selectTool).toHaveBeenLastCalledWith('navigate');
    expect(terrain?.getAttribute('aria-pressed')).toBe('false');
    expect(shell.subToolTray.element.hasAttribute('hidden')).toBe(true);
    expect(shell.toolContextSheet.element.hidden).toBe(true);

    shell.dispose();
  });
});
