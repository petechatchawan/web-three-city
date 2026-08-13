import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPlayerShell } from './player-shell.js';

afterEach(() => document.body.replaceChildren());

describe('player shell', () => {
  it('mounts world-centric semantic actions without a sidebar', () => {
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
    expect(shell.element.textContent).toContain('Information Views');
    expect(shell.element.textContent).toContain('City');
    expect(shell.element.textContent).toContain('Game Menu');
    expect(shell.element.textContent).toContain('Step');
    expect(shell.element.querySelectorAll('.city-bottom-nav [data-nav-category]')).toHaveLength(5);
    expect(shell.element.querySelector('.city-bottom-nav .city-simulation-controls')).toBeNull();
    expect(
      shell.element.querySelector('.city-simulation-controls.city-simulation-capsule'),
    ).not.toBeNull();
    const actions = [
      ...shell.element.querySelectorAll<HTMLButtonElement>('.city-top-actions button'),
    ];
    expect(actions.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Information Views',
      'City',
      'Game Menu',
    ]);
    expect(actions.every((button) => button.classList.contains('city-icon-button'))).toBe(true);
    shell.dispose();
    expect(document.body.contains(shell.element)).toBe(false);
  });
});
