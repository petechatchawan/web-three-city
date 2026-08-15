import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPlayerShell } from './player-shell.js';

afterEach(() => document.body.replaceChildren());

describe('player shell M6.4 mobile declutter state model', () => {
  it('keeps Build presentation separate from active gameplay tool state', () => {
    const selectTool = vi.fn();
    const onCity = vi.fn();
    const shell = mountPlayerShell(document.body, {
      onInformationViews: vi.fn(),
      onCity,
      onGameMenu: vi.fn(),
      setSpeed: vi.fn(),
      step: vi.fn(),
      selectTool,
      setTerraformBrush: vi.fn(),
      onSelectMetric: vi.fn(),
      onUndo: vi.fn(),
    });

    expect(shell.element.querySelector('[data-testid="nav-build"]')).not.toBeNull();
    expect(shell.element.querySelector('[data-testid="nav-city"]')).not.toBeNull();
    expect(shell.element.querySelector('[data-testid="nav-terrain"]')).toBeNull();
    expect(shell.subToolTray.element.hidden).toBe(true);
    expect(shell.toolContextSheet.element.hidden).toBe(true);

    shell.element.querySelector<HTMLButtonElement>('[data-testid="nav-build"]')!.click();
    expect(selectTool).not.toHaveBeenCalled();
    expect(shell.subToolTray.element.hidden).toBe(false);
    expect(shell.subToolTray.element.querySelectorAll('[data-build-category]').length).toBe(4);

    shell.subToolTray.element
      .querySelector<HTMLButtonElement>('[data-testid="build-category-terrain"]')!
      .click();
    expect(shell.subToolTray.element.querySelectorAll('[data-tool-mode]').length).toBe(3);
    expect(shell.subToolTray.element.querySelectorAll('[data-brush-size]').length).toBe(3);

    shell.subToolTray.element.querySelector<HTMLButtonElement>('[data-tool-mode="lower"]')!.click();
    expect(selectTool).toHaveBeenLastCalledWith('lower');
    expect(shell.subToolTray.element.hidden).toBe(true);
    expect(shell.toolContextSheet.element.hidden).toBe(false);
    expect(shell.toolContextSheet.element.textContent).toContain('Lower');
    expect(
      shell.element
        .querySelector<HTMLButtonElement>('[data-testid="nav-build"]')!
        .getAttribute('aria-pressed'),
    ).toBe('false');

    shell.element.querySelector<HTMLButtonElement>('[data-testid="nav-build"]')!.click();
    expect(shell.subToolTray.element.dataset.category).toBe('terrain');
    expect(shell.subToolTray.element.querySelector('[data-tool-mode="raise"]')).not.toBeNull();
    expect(shell.subToolTray.element.querySelectorAll('[data-build-category]').length).toBe(0);

    shell.element.querySelector<HTMLButtonElement>('[data-testid="nav-city"]')!.click();
    expect(onCity).toHaveBeenCalledTimes(1);
    expect(shell.subToolTray.element.hidden).toBe(true);
    expect(selectTool).toHaveBeenLastCalledWith('lower');

    shell.dispose();
  });
});
