import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPlayerShell } from './player-shell.js';

afterEach(() => document.body.replaceChildren());

describe('player shell M6.2 mobile state model', () => {
  it('moves Navigate -> Build -> category -> Navigate without persistent build chrome', () => {
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

    expect(shell.element.querySelector('aside')).toBeNull();
    expect(shell.element.querySelector('[data-testid="build-cta"]')).not.toBeNull();
    expect(shell.element.querySelector('.city-build-category-dock')?.hasAttribute('hidden')).toBe(
      true,
    );
    expect(shell.subToolTray.element.hasAttribute('hidden')).toBe(true);
    expect(shell.element.querySelector('.city-tool-context')).toBeNull();

    const build = shell.element.querySelector<HTMLButtonElement>('[data-testid="build-cta"]');
    build?.click();
    expect(shell.element.querySelector('.city-build-category-dock')?.hasAttribute('hidden')).toBe(
      false,
    );
    expect(shell.subToolTray.element.hasAttribute('hidden')).toBe(true);
    expect(selectTool).not.toHaveBeenCalled();

    const terrain = shell.element.querySelector<HTMLButtonElement>(
      '[data-build-category="terrain"]',
    );
    terrain?.click();
    expect(selectTool).toHaveBeenLastCalledWith('raise');
    expect(shell.subToolTray.element.hasAttribute('hidden')).toBe(false);
    expect(shell.subToolTray.element.querySelectorAll('[data-tool-mode]').length).toBe(3);
    expect(shell.subToolTray.element.querySelectorAll('[data-brush-size]').length).toBe(3);

    const close = shell.element.querySelector<HTMLButtonElement>('[data-testid="build-close"]');
    close?.click();
    expect(selectTool).toHaveBeenLastCalledWith('navigate');
    expect(shell.element.querySelector('.city-build-category-dock')?.hasAttribute('hidden')).toBe(
      true,
    );
    expect(shell.subToolTray.element.hasAttribute('hidden')).toBe(true);

    shell.dispose();
  });
});
