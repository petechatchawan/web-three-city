import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPlayerShell } from './player-shell.js';

afterEach(() => document.body.replaceChildren());

describe('player shell', () => {
  it('mounts simulation controls inside top actions and tool context inside the active tray', () => {
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
    const simulation = shell.element.querySelector('.city-simulation-controls--top-actions')!;
    expect(topActions.contains(simulation)).toBe(true);
    expect(simulation.querySelector('[data-simulation-speed]')).not.toBeNull();
    expect(simulation.querySelector('[data-simulation-step]')).not.toBeNull();

    expect(shell.subToolTray.element.hasAttribute('hidden')).toBe(true);
    shell.bottomNav.element
      .querySelector<HTMLButtonElement>('[data-testid="nav-terrain"]')!
      .click();
    expect(shell.subToolTray.element.hasAttribute('hidden')).toBe(false);
    expect(shell.toolContextSheet.element.parentElement).toBe(shell.subToolTray.element);
    expect(shell.toolContextSheet.element.dataset.toolMode).toBe('raise');

    shell.bottomNav.element
      .querySelector<HTMLButtonElement>('[data-testid="nav-navigate"]')!
      .click();
    expect(shell.subToolTray.element.hasAttribute('hidden')).toBe(true);

    shell.dispose();
  });
});
