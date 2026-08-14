import { createCityIcon } from '../components/icon.js';
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

export function mountGameHud(
  parent: HTMLElement,
  callbacks: GameHudCallbacks,
): UiAdapter<GameHudProjection> {
  const element = document.createElement('section');
  element.className = 'city-awareness-hud city-mobile-hud';
  element.setAttribute('aria-label', 'City status');

  const values = new Map<'population' | 'treasury' | 'net' | 'demand' | 'gameTime', HTMLElement>();

  const cityValues = document.createElement('button');
  cityValues.type = 'button';
  cityValues.className = 'city-mobile-hud-group city-mobile-hud-group--city';
  cityValues.dataset.metricGroup = 'city-values';
  cityValues.setAttribute('aria-label', 'City overview');
  cityValues.addEventListener('click', () => callbacks.onSelectMetric('population'));

  for (const definition of [
    ['population', 'population', 'Population'],
    ['treasury', 'treasury', 'Treasury'],
    ['net', 'net', 'Net'],
  ] as const) {
    const metric = document.createElement('span');
    metric.className = `city-mobile-hud-metric city-mobile-hud-metric--${definition[0]}`;
    metric.dataset.metric = definition[0];
    metric.append(createCityIcon(definition[1]));
    const value = document.createElement('strong');
    value.className = 'city-mobile-hud-value';
    value.setAttribute('aria-label', definition[2]);
    metric.append(value);
    values.set(definition[0], value);
    cityValues.append(metric);
  }

  const demand = document.createElement('button');
  demand.type = 'button';
  demand.className = 'city-mobile-hud-group city-mobile-hud-group--demand';
  demand.dataset.metric = 'demand';
  demand.setAttribute('aria-label', 'RCI demand');
  demand.append(createCityIcon('demand'));
  const demandValue = document.createElement('strong');
  demandValue.className = 'city-mobile-hud-value city-mobile-hud-value--demand';
  demand.append(demandValue);
  values.set('demand', demandValue);
  demand.addEventListener('click', () => callbacks.onSelectMetric('demand'));

  const time = document.createElement('button');
  time.type = 'button';
  time.className = 'city-mobile-hud-group city-mobile-hud-group--time';
  time.dataset.metric = 'gameTime';
  time.setAttribute('aria-label', 'Game time');
  time.append(createCityIcon('time'));
  const timeValue = document.createElement('strong');
  timeValue.className = 'city-mobile-hud-value city-mobile-hud-value--time';
  time.append(timeValue);
  values.set('gameTime', timeValue);
  time.addEventListener('click', () => callbacks.onSelectMetric('gameTime'));

  element.append(cityValues, demand, time);
  parent.append(element);

  return Object.freeze({
    element,
    update(projection: GameHudProjection): void {
      for (const key of ['population', 'treasury', 'net', 'demand', 'gameTime'] as const) {
        values.get(key)!.textContent = projection[key];
      }
    },
    dispose(): void {
      element.remove();
    },
  });
}
