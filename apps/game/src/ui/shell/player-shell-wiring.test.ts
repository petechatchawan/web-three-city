import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameToolMode } from '../../game-tool-mode.js';
import { mountPlayerShell, type PlayerShellCallbacks } from './player-shell.js';
import type { TrayCategory } from './subtool-tray.js';

const defaultToolForCategory: Readonly<Record<TrayCategory, GameToolMode>> = {
  terrain: 'raise',
  roads: 'road-build',
  zones: 'zone-residential',
  buildings: 'building-bulldoze',
};

afterEach(() => document.body.replaceChildren());

function mountSpyShell(callbacks: Partial<PlayerShellCallbacks> = {}) {
  return mountPlayerShell(document.body, {
    onInformationViews: vi.fn(),
    onCity: vi.fn(),
    onGameMenu: vi.fn(),
    setSpeed: vi.fn(),
    step: vi.fn(),
    selectTool: vi.fn(),
    setTerraformBrush: vi.fn(),
    onSelectMetric: vi.fn(),
    onUndo: vi.fn(),
    ...callbacks,
  });
}

function selectCategory(shell: ReturnType<typeof mountSpyShell>, category: TrayCategory): void {
  shell.element.querySelector<HTMLButtonElement>(`[data-testid="nav-${category}"]`)?.click();
}

describe('player shell M6.3 Figma wiring', () => {
  it('boots in implicit Navigate with only the persistent Figma bottom bar', () => {
    const shell = mountSpyShell();
    expect(shell.subToolTray.element.hidden).toBe(true);
    expect(shell.toolContextSheet.element.hidden).toBe(true);
    expect(shell.element.querySelector('.city-bottom-nav')).not.toBeNull();
    expect(shell.element.querySelector('.city-top-actions')).toBeNull();
    expect(shell.element.querySelector('[data-testid="build-cta"]')).toBeNull();
    expect(shell.element.textContent).not.toContain('Navigate');
  });

  it('selects each default tool directly from its persistent build category', () => {
    for (const category of Object.keys(defaultToolForCategory) as TrayCategory[]) {
      const onSelect = vi.fn();
      const shell = mountSpyShell({ selectTool: onSelect });
      selectCategory(shell, category);
      expect(onSelect).toHaveBeenLastCalledWith(defaultToolForCategory[category]);
      expect(shell.subToolTray.element.hidden).toBe(false);
      shell.dispose();
    }
  });

  it('tapping the active category again returns to Navigate and closes contextual tools', () => {
    const onSelect = vi.fn();
    const shell = mountSpyShell({ selectTool: onSelect });
    selectCategory(shell, 'zones');
    expect(onSelect).toHaveBeenLastCalledWith('zone-residential');
    selectCategory(shell, 'zones');
    expect(onSelect).toHaveBeenLastCalledWith('navigate');
    expect(shell.subToolTray.element.hidden).toBe(true);
  });

  it('forwards Figma HUD groups through existing metric authority', () => {
    const onSelectMetric = vi.fn();
    const shell = mountSpyShell({ onSelectMetric });
    shell.element.querySelector<HTMLButtonElement>('[data-metric="demand"]')?.click();
    expect(onSelectMetric).toHaveBeenCalledWith('demand');
    shell.element.querySelector<HTMLButtonElement>('[data-metric="gameTime"]')?.click();
    expect(onSelectMetric).toHaveBeenLastCalledWith('gameTime');
    shell.dispose();
  });

  it('selects an exact contextual subtool and exposes a collapsed authoritative context sheet', () => {
    const onSelect = vi.fn();
    const shell = mountSpyShell({ selectTool: onSelect });
    selectCategory(shell, 'zones');
    const commercial = shell.subToolTray.element.querySelector<HTMLButtonElement>(
      '[data-tool-mode="zone-commercial"]',
    );
    commercial?.click();
    expect(onSelect).toHaveBeenLastCalledWith('zone-commercial');

    shell.toolContextSheet.update({
      mode: 'zone-commercial',
      name: 'Commercial Zone',
      state: 'Ready',
      message: 'Point at the world to preview this tool',
    });
    expect(shell.toolContextSheet.element.hidden).toBe(false);
    expect(shell.toolContextSheet.element.textContent).toContain('Commercial Zone');
    expect(shell.toolContextSheet.element.textContent).toContain('Ready');
    expect(shell.toolContextSheet.element.textContent).not.toContain(
      'Point at the world to preview this tool',
    );
  });
});
