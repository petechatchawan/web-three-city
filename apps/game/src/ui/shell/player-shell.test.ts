import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPlayerShell } from './player-shell.js';

afterEach(() => document.body.replaceChildren());

describe('player shell', () => {
  it('mounts a compact mobile control hierarchy without a sidebar', () => {
    const shell = mountPlayerShell(document.body, {
      onInformationViews: vi.fn(),
      onCity: vi.fn(),
      onGameMenu: vi.fn(),
      setSpeed: vi.fn(),
      step: vi.fn(),
      selectTool: vi.fn(),
      setTerraformBrush: vi.fn(),
      onSelectMetric: vi.fn(),
      onUndo: vi.fn(),
    });
    expect(shell.element.querySelector('aside')).toBeNull();
    expect(shell.element.querySelectorAll('.city-bottom-nav [data-nav-category]')).toHaveLength(5);

    const topActions = shell.element.querySelector('.city-top-actions')!;
    expect(topActions.querySelector('[data-simulation-speed]')).not.toBeNull();
    expect(topActions.querySelector('[data-simulation-step]')).not.toBeNull();
    expect(shell.element.querySelector(':scope > .city-simulation-controls')).toBeNull();

    const terrain = shell.bottomNav.element.querySelector<HTMLButtonElement>(
      '[data-testid="nav-terrain"]',
    )!;
    terrain.click();
    expect(shell.toolContextSheet.element.parentElement).toBe(shell.subToolTray.element);
    expect(shell.subToolTray.element.hasAttribute('hidden')).toBe(false);

    const actions = [...topActions.querySelectorAll<HTMLButtonElement>(':scope > button')];
    expect(actions.slice(0, 3).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Information Views',
      'City',
      'Game Menu',
    ]);
    shell.dispose();
    expect(document.body.contains(shell.element)).toBe(false);
  });
});
