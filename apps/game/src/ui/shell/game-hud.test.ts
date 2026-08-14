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

describe('M6.2 mobile game HUD', () => {
  it('renders only Population, Treasury, and Game time in persistent chrome', () => {
    const hud = mountGameHud(document.body, { onSelectMetric: vi.fn() });
    hud.update(projection);
    expect(
      Array.from(
        hud.element.querySelectorAll<HTMLElement>('[data-metric]'),
        (metric) => metric.dataset.metric,
      ),
    ).toEqual([
      'population',
      'population',
      'treasury',
      'treasury',
      'gameTime',
      'gameTime',
    ]);
    expect(hud.element.textContent).toContain('337');
    expect(hud.element.textContent).toContain('100K');
    expect(hud.element.textContent).toContain('Y1 M5 D19 06:45');
    expect(hud.element.textContent).not.toContain('+7K');
    expect(hud.element.textContent).not.toContain('R↑ C↑ I→');
    expect(hud.element.textContent).not.toContain('2');
    expect(hud.element.querySelector('.city-hud-secondary')).toBeNull();
  });

  it('keeps primary metrics accessible and forwards metric taps', () => {
    const onSelectMetric = vi.fn();
    const hud = mountGameHud(document.body, { onSelectMetric });
    for (const metric of ['population', 'treasury', 'gameTime'] as const) {
      const chip = hud.element.querySelector<HTMLButtonElement>(
        `button[data-metric="${metric}"]`,
      );
      expect(chip).not.toBeNull();
      expect(chip?.getAttribute('role')).toBe('button');
      chip?.click();
      expect(onSelectMetric).toHaveBeenLastCalledWith(metric);
    }
  });

  it('keeps secondary projection fields out of persistent DOM without changing the projection API', () => {
    const hud = mountGameHud(document.body, { onSelectMetric: vi.fn() });
    hud.update(projection);
    for (const metric of ['net', 'demand', 'construction', 'active', 'total']) {
      expect(hud.element.querySelector(`[data-metric="${metric}"]`)).toBeNull();
    }
    expect(projection.net).toBe('+7K');
    expect(projection.total).toBe('7');
  });
});
