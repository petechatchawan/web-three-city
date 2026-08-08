import { afterEach, describe, expect, it } from 'vitest';
import { mountGameHud, type GameHudProjection } from './game-hud.js';

afterEach(() => document.body.replaceChildren());

const projection: GameHudProjection = {
  population: '337',
  treasury: '100K',
  net: '+7K',
  demand: 'R↑ C↑ I→',
  gameTime: 'Y1 M5 D19 06:45',
};

describe('game HUD', () => {
  it('updates awareness metrics without announcing every tick and disposes', () => {
    const hud = mountGameHud(document.body);
    hud.update(projection);
    expect(hud.element.textContent).toContain('337');
    expect(hud.element.textContent).toContain('Y1 M5 D19 06:45');
    expect(hud.element.hasAttribute('aria-live')).toBe(false);
    hud.dispose();
    expect(document.body.contains(hud.element)).toBe(false);
  });
});
