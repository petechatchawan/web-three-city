import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameToolMode } from '../../game-tool-mode.js';
import { mountPlayerShell, type PlayerShellCallbacks } from './player-shell.js';
import type { NavCategory } from './bottom-nav.js';
import type { TrayCategory } from './subtool-tray.js';

const defaultToolForCategory: Readonly<Record<TrayCategory, GameToolMode>> = {
  terrain: 'raise',
  roads: 'road-build',
  zones: 'zone-residential',
  buildings: 'building-bulldoze',
};

const categoryButtons: Readonly<Record<TrayCategory, NavCategory>> = {
  terrain: 'terrain',
  roads: 'roads',
  zones: 'zones',
  buildings: 'buildings',
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
    ...callbacks,
  });
}

function navButton(shell: ReturnType<typeof mountSpyShell>, category: NavCategory) {
  return shell.bottomNav.element.querySelector<HTMLButtonElement>(
    `[data-testid="nav-${category}"]`,
  );
}

function contextText(shell: ReturnType<typeof mountSpyShell>): string {
  return shell.element.querySelector<HTMLElement>('.city-tool-context')?.textContent ?? '';
}

describe('player shell wiring', () => {
  it('renders the navigate projection on boot', () => {
    const shell = mountSpyShell();
    expect(contextText(shell)).toContain('Navigate');
    expect(contextText(shell)).toContain('Inspect or move around the city');
    expect(contextText(shell)).toContain('Undo unavailable');
  });

  it('opens the matching tray, selects the default tool, and projects it for every category', () => {
    for (const category of Object.keys(defaultToolForCategory) as TrayCategory[]) {
      const onSelect = vi.fn();
      const shell = mountSpyShell({ selectTool: onSelect });
      const mode = defaultToolForCategory[category];
      const expectedName = mode
        .split('-')
        .map((w) => w[0]!.toUpperCase() + w.slice(1))
        .join(' ');
      navButton(shell, categoryButtons[category])!.click();
      expect(shell.subToolTray.element.hasAttribute('hidden')).toBe(false);
      const trayModes = Array.from(
        shell.subToolTray.element.querySelectorAll<HTMLButtonElement>('[data-tool-mode]'),
        (b) => b.dataset.toolMode,
      );
      expect(trayModes).toContain(mode);
      expect(trayModes.length).toBeGreaterThan(0);
      expect(onSelect).toHaveBeenCalledWith(mode);
      const text = contextText(shell);
      expect(text).toContain(expectedName);
      expect(text).toContain('Ready');
      expect(text).toContain('Point at the world to preview this tool');
      shell.dispose();
    }
  });

  it('empty tray and navigate back: closes the tray, selects navigate, projects navigate', () => {
    const onSelect = vi.fn();
    const shell = mountSpyShell({ selectTool: onSelect });
    navButton(shell, 'zones')!.click();
    expect(onSelect).toHaveBeenLastCalledWith('zone-residential');
    navButton(shell, 'navigate')!.click();
    expect(onSelect).toHaveBeenLastCalledWith('navigate');
    expect(shell.subToolTray.element.hasAttribute('hidden')).toBe(true);
    expect(shell.subToolTray.element.querySelectorAll('[data-tool-mode]').length).toBe(0);
    const text = contextText(shell);
    expect(text).toContain('Navigate');
    expect(text).toContain('Inspect or move around the city');
  });

  it('forwards awareness metric taps on the HUD to onSelectMetric', () => {
    const onSelectMetric = vi.fn();
    const shell = mountSpyShell({ onSelectMetric });
    shell.element.querySelector<HTMLButtonElement>('[data-metric="population"]')!.click();
    expect(onSelectMetric).toHaveBeenCalledWith('population');
    shell.dispose();
  });

  it('tray subtool click selects that exact mode and projects it', () => {
    const onSelect = vi.fn();
    const shell = mountSpyShell({ selectTool: onSelect });
    navButton(shell, 'zones')!.click();
    const commercial = shell.subToolTray.element.querySelector<HTMLButtonElement>(
      '[data-tool-mode="zone-commercial"]',
    )!;
    commercial.click();
    expect(onSelect).toHaveBeenLastCalledWith('zone-commercial');
    const text = contextText(shell);
    expect(text).toContain('Zone Commercial');
    expect(text).toContain('Ready');
    expect(text).toContain('Point at the world to preview this tool');
  });
});
