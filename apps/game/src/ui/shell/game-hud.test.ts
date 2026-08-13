import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountGameHud, type GameHudProjection } from './game-hud.js';

afterEach(() => document.body.replaceChildren());

const projection: GameHudProjection = {
  population: '337',
  treasury: '100K',
  net: '+7K',
  demand: 'R↑ C↑ I→',
  gameTime: 'Y1 M5 D19 06:45',
  construction: '2',
  active: '5',
  total: '7',
};

describe('game HUD', () => {
  it('updates awareness metrics without announcing every tick and disposes', () => {
    const hud = mountGameHud(document.body, { onSelectMetric: vi.fn() });
    hud.update(projection);
    expect(hud.element.textContent).toContain('337');
    expect(hud.element.textContent).toContain('Y1 M5 D19 06:45');
    expect(hud.element.textContent).toContain('2');
    expect(hud.element.textContent).toContain('5');
    expect(hud.element.textContent).toContain('7');
    expect(hud.element.hasAttribute('aria-live')).toBe(false);
    hud.dispose();
    expect(document.body.contains(hud.element)).toBe(false);
  });

  it('exposes each metric chip as a role=button and dispatches onSelectMetric on tap', () => {
    const onSelectMetric = vi.fn();
    const hud = mountGameHud(document.body, { onSelectMetric });
    const chip = hud.element.querySelector<HTMLButtonElement>('[data-metric="population"]')!;
    expect(chip.getAttribute('role')).toBe('button');
    expect(chip.getAttribute('aria-label')).toBe('Population');
    chip.click();
    expect(onSelectMetric).toHaveBeenCalledWith('population');
    hud.dispose();
  });

  it('exposes calendar and building lifecycle chips as data-metric values', () => {
    const hud = mountGameHud(document.body, { onSelectMetric: vi.fn() });
    hud.update(projection);
    const value = (metric: string): string | null | undefined =>
      hud.element.querySelector(`[data-metric="${metric}"] strong`)?.textContent;
    expect(value('gameTime')).toBe('Y1 M5 D19 06:45');
    expect(value('construction')).toBe('2');
    expect(value('active')).toBe('5');
    expect(value('total')).toBe('7');
    hud.dispose();
  });
});
