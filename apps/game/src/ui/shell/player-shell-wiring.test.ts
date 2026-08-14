import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPlayerShell, type PlayerShellCallbacks } from './player-shell.js';

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

describe('player shell M6.4 wiring', () => {
  it('boots in implicit Navigate with only Build, City, and simulation chrome', () => {
    const shell = mountSpyShell();
    expect(shell.subToolTray.element.hidden).toBe(true);
    expect(shell.toolContextSheet.element.hidden).toBe(true);
    expect(shell.element.querySelector('[data-testid="nav-build"]')).not.toBeNull();
    expect(shell.element.querySelector('[data-testid="nav-city"]')).not.toBeNull();
    expect(shell.element.querySelector('[data-testid="nav-terrain"]')).toBeNull();
    expect(shell.element.querySelector('.city-top-actions')).toBeNull();
    expect(shell.element.textContent).not.toContain('Navigate');
  });

  it('opens Build categories without synthesizing a gameplay selection', () => {
    const onSelect = vi.fn();
    const shell = mountSpyShell({ selectTool: onSelect });
    shell.element.querySelector<HTMLButtonElement>('[data-testid="nav-build"]')!.click();
    expect(onSelect).not.toHaveBeenCalled();
    expect(shell.subToolTray.element.hidden).toBe(false);
    expect(shell.subToolTray.element.querySelectorAll('[data-build-category]')).toHaveLength(4);
  });

  it('selects one exact tool from the requested category then returns map space', () => {
    const onSelect = vi.fn();
    const shell = mountSpyShell({ selectTool: onSelect });
    shell.element.querySelector<HTMLButtonElement>('[data-testid="nav-build"]')!.click();
    shell.subToolTray.element
      .querySelector<HTMLButtonElement>('[data-testid="build-category-zones"]')!
      .click();
    shell.subToolTray.element
      .querySelector<HTMLButtonElement>('[data-tool-mode="zone-commercial"]')!
      .click();
    expect(onSelect).toHaveBeenLastCalledWith('zone-commercial');
    expect(shell.subToolTray.element.hidden).toBe(true);
    expect(shell.toolContextSheet.element.textContent).toContain('Commercial');
  });

  it('forwards compact HUD groups through existing metric authority', () => {
    const onSelectMetric = vi.fn();
    const shell = mountSpyShell({ onSelectMetric });
    shell.element.querySelector<HTMLButtonElement>('[data-metric="demand"]')?.click();
    expect(onSelectMetric).toHaveBeenCalledWith('demand');
    shell.element.querySelector<HTMLButtonElement>('[data-metric="gameTime"]')?.click();
    expect(onSelectMetric).toHaveBeenLastCalledWith('gameTime');
    shell.dispose();
  });

  it('keeps the authoritative tool context collapsed until details are requested', () => {
    const shell = mountSpyShell();
    shell.toolContextSheet.update({
      mode: 'zone-commercial',
      name: 'Commercial Zone',
      state: 'Ready',
      message: 'Point at the world to preview this tool',
    });
    expect(shell.toolContextSheet.element.hidden).toBe(false);
    expect(shell.toolContextSheet.element.dataset.expanded).toBe('false');
    expect(shell.toolContextSheet.element.textContent).toContain('Commercial Zone');
    expect(shell.toolContextSheet.element.textContent).toContain('Ready');
    expect(shell.toolContextSheet.element.textContent).not.toContain(
      'Point at the world to preview this tool',
    );
  });
});
