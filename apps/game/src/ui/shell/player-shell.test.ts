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
    shell.dispose();
    expect(document.body.contains(shell.element)).toBe(false);
  });
});
