import type { UiAdapter } from '../foundation/lifecycle.js';

export interface GameHudProjection {
  readonly population: string;
  readonly treasury: string;
  readonly net: string;
  readonly demand: string;
  readonly gameTime: string;
}

const metrics: ReadonlyArray<readonly [keyof GameHudProjection, string]> = [
  ['population', 'Population'],
  ['treasury', 'Treasury'],
  ['net', 'Current net'],
  ['demand', 'RCI demand'],
  ['gameTime', 'Game time'],
];

export function mountGameHud(parent: HTMLElement): UiAdapter<GameHudProjection> {
  const element = document.createElement('section');
  element.className = 'city-awareness-hud';
  element.setAttribute('aria-label', 'City status');
  const values = new Map<keyof GameHudProjection, HTMLElement>();
  for (const [key, label] of metrics) {
    const metric = document.createElement('div');
    metric.className = 'city-metric';
    metric.setAttribute('aria-label', label);
    const value = document.createElement('strong');
    value.dataset.metric = key;
    metric.append(value);
    values.set(key, value);
    element.append(metric);
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
