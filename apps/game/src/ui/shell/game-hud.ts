import type { UiAdapter } from '../foundation/lifecycle.js';

export interface GameHudProjection {
  readonly population: string;
  readonly treasury: string;
  readonly net: string;
  readonly demand: string;
  readonly gameTime: string;
  readonly construction: string;
  readonly active: string;
  readonly total: string;
}

export type GameHudMetricId = keyof GameHudProjection;

export interface GameHudCallbacks {
  readonly onSelectMetric: (metric: GameHudMetricId) => void;
}

const metrics: ReadonlyArray<readonly [GameHudMetricId, string]> = [
  ['population', 'Population'],
  ['treasury', 'Treasury'],
  ['net', 'Current net'],
  ['demand', 'RCI demand'],
  ['gameTime', 'Game time'],
  ['construction', 'Under construction'],
  ['active', 'Active buildings'],
  ['total', 'Total buildings'],
];

export function mountGameHud(
  parent: HTMLElement,
  callbacks: GameHudCallbacks,
): UiAdapter<GameHudProjection> {
  const element = document.createElement('section');
  element.className = 'city-awareness-hud';
  element.setAttribute('aria-label', 'City status');
  const values = new Map<GameHudMetricId, HTMLElement>();
  for (const [key, label] of metrics) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.setAttribute('role', 'button');
    chip.className = 'city-metric';
    chip.dataset.metric = key;
    chip.setAttribute('aria-label', label);
    chip.addEventListener('click', () => callbacks.onSelectMetric(key));
    const value = document.createElement('strong');
    value.dataset.metric = key;
    chip.append(value);
    values.set(key, value);
    element.append(chip);
  }
  parent.append(element);
  return Object.freeze({
    element,
    update(projection: GameHudProjection): void {
      for (const [key] of metrics) values.get(key)!.textContent = projection[key];
    },
    dispose(): void {
      element.remove();
    },
  });
}
