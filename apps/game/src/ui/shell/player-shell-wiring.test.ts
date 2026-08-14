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

function openBuild(shell: ReturnType<typeof mountSpyShell>): void {
  shell.element.querySelector<HTMLButtonElement>('[data-testid="build-cta"]')?.click();
}

function selectCategory(shell: ReturnType<typeof mountSpyShell>, category: TrayCategory): void {
  shell.element.querySelector<HTMLButtonElement>(`[data-build-category="${category}"]`)?.click();
}

describe('player shell M6.2 wiring', () => {
  it('boots in Navigate with Build closed and no permanent Tool Context copy', () => {
    const shell = mountSpyShell();
    expect(shell.buildCategoryDock.element.hidden).toBe(true);
    expect(shell.subToolTray.element.hidden).toBe(true);
    expect(shell.toolContextSheet.element.hidden).toBe(true);
    expect(shell.element.textContent).not.toContain('Inspect or move around the city');
    expect(shell.element.textContent).not.toContain('Undo unavailable');
  });

  it('selects the default tool only after a Build category is chosen', () => {
    for (const category of Object.keys(defaultToolForCategory) as TrayCategory[]) {
      const onSelect = vi.fn();
      const shell = mountSpyShell({ selectTool: onSelect });
      openBuild(shell);
      expect(onSelect).not.toHaveBeenCalled();
      selectCategory(shell, category);
      expect(onSelect).toHaveBeenLastCalledWith(defaultToolForCategory[category]);
      expect(shell.subToolTray.element.hidden).toBe(false);
      shell.dispose();
    }
  });

  it('Close Build returns to Navigate and hides both conditional docks', () => {
    const onSelect = vi.fn();
    const shell = mountSpyShell({ selectTool: onSelect });
    openBuild(shell);
    selectCategory(shell, 'zones');
    expect(onSelect).toHaveBeenLastCalledWith('zone-residential');
    shell.element.querySelector<HTMLButtonElement>('[data-testid="build-close"]')?.click();
    expect(onSelect).toHaveBeenLastCalledWith('navigate');
    expect(shell.buildCategoryDock.element.hidden).toBe(true);
    expect(shell.subToolTray.element.hidden).toBe(true);
  });

  it('forwards awareness metric taps on the HUD to onSelectMetric', () => {
    const onSelectMetric = vi.fn();
    const shell = mountSpyShell({ onSelectMetric });
    shell.element.querySelector<HTMLButtonElement>('[data-metric="population"]')?.click();
    expect(onSelectMetric).toHaveBeenCalledWith('population');
    shell.dispose();
  });

  it('selects an exact contextual subtool without creating permanent status copy', () => {
    const onSelect = vi.fn();
    const shell = mountSpyShell({ selectTool: onSelect });
    openBuild(shell);
    selectCategory(shell, 'zones');
    const commercial = shell.subToolTray.element.querySelector<HTMLButtonElement>(
      '[data-tool-mode="zone-commercial"]',
    );
    commercial?.click();
    expect(onSelect).toHaveBeenLastCalledWith('zone-commercial');
    expect(shell.toolContextSheet.element.hidden).toBe(true);
    expect(shell.element.textContent).not.toContain('Point at the world to preview this tool');
  });
});
