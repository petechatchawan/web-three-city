import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPlayerShell } from './player-shell.js';

afterEach(() => document.body.replaceChildren());

describe('player shell', () => {
  it('mounts compact top simulation actions and keeps contextual tooling', () => {
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
    expect(shell.element.querySelector('.city-simulation-controls--top-actions')).not.toBeNull();
    expect(shell.element.querySelector('[data-simulation-speed]')).not.toBeNull();
    expect(shell.element.querySelector('[data-simulation-step]')).not.toBeNull();

    shell.bottomNav.element
      .querySelector<HTMLButtonElement>('[data-testid="nav-terrain"]')!
      .click();
    expect(shell.subToolTray.element.hasAttribute('hidden')).toBe(false);
    expect(shell.toolContextSheet.element.dataset.toolMode).toBe('raise');
    shell.dispose();
  });
});
