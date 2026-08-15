import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountGameHud, type GameHudProjection } from './game-hud.js';

afterEach(() => document.body.replaceChildren());

const projection: GameHudProjection = {
  population: '337',
  treasury: '100K',
  net: '+7K',
  demand: 'R↑ C↑ I→',
  residentialDemand: 42,
  commercialDemand: 18,
  industrialDemand: 0,
  gameTime: 'Y1 M5 D19 06:45',
  construction: '2',
  active: '5',
  total: '7',
};

describe('M6.4 mobile game HUD', () => {
  it('renders Population, Treasury, Net, explicit RCI bars, and Time in compact groups', () => {
    const hud = mountGameHud(document.body, { onSelectMetric: vi.fn() });
    hud.update(projection);

    expect(hud.element.querySelectorAll('.city-mobile-hud-group')).toHaveLength(3);
    for (const metric of ['population', 'treasury', 'net', 'demand', 'gameTime']) {
      expect(hud.element.querySelector(`[data-metric="${metric}"]`)).not.toBeNull();
    }
    expect(hud.element.querySelectorAll('[data-rci-demand-bar]')).toHaveLength(3);
    expect(
      hud.element.querySelector('[data-rci-demand-bar="residential"]')?.getAttribute('aria-label'),
    ).toContain('Residential demand 42');
    expect(hud.element.textContent).toContain('337');
    expect(hud.element.textContent).toContain('100K');
    expect(hud.element.textContent).toContain('+7K');
    expect(hud.element.textContent).toContain('Y1 M5 D19 06:45');
    expect(hud.element.textContent).not.toContain('R↑ C↑ I→');
    expect(hud.element.textContent).not.toContain('Construction');
  });

  it('routes city values, RCI, and Time through the existing metric callback', () => {
    const onSelectMetric = vi.fn();
    const hud = mountGameHud(document.body, { onSelectMetric });
    hud.update(projection);

    hud.element.querySelector<HTMLButtonElement>('[data-metric-group="city-values"]')?.click();
    expect(onSelectMetric).toHaveBeenLastCalledWith('population');
    hud.element.querySelector<HTMLButtonElement>('[data-metric="demand"]')?.click();
    expect(onSelectMetric).toHaveBeenLastCalledWith('demand');
    hud.element.querySelector<HTMLButtonElement>('[data-metric="gameTime"]')?.click();
    expect(onSelectMetric).toHaveBeenLastCalledWith('gameTime');
  });

  it('keeps construction lifecycle values out of persistent DOM without changing projection authority', () => {
    const hud = mountGameHud(document.body, { onSelectMetric: vi.fn() });
    hud.update(projection);
    for (const metric of ['construction', 'active', 'total']) {
      expect(hud.element.querySelector(`[data-metric="${metric}"]`)).toBeNull();
    }
    expect(projection.construction).toBe('2');
    expect(projection.active).toBe('5');
    expect(projection.total).toBe('7');
  });

  it('switches accessibility copy to Thai without changing demand values', () => {
    const hud = mountGameHud(document.body, { onSelectMetric: vi.fn() });
    hud.update(projection);
    hud.setLocale('th');
    expect(
      hud.element.querySelector('[data-rci-demand-bar="residential"]')?.getAttribute('aria-label'),
    ).toContain('ความต้องการที่อยู่อาศัย 42');
    expect(projection.residentialDemand).toBe(42);
  });
});
