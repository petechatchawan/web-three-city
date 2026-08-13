import type { UiAdapter } from '../foundation/lifecycle.js';
import { createCityIcon, type CityIconName } from '../components/icon.js';

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

type MetricDefinition = Readonly<{
  key: GameHudMetricId;
  label: string;
  icon: CityIconName;
  group: 'primary' | 'secondary';
}>;

const metrics: readonly MetricDefinition[] = [
  { key: 'population', label: 'Population', icon: 'population', group: 'primary' },
  { key: 'treasury', label: 'Treasury', icon: 'treasury', group: 'primary' },
  { key: 'gameTime', label: 'Game time', icon: 'time', group: 'primary' },
  { key: 'net', label: 'Current net', icon: 'net', group: 'secondary' },
  { key: 'demand', label: 'RCI demand', icon: 'demand', group: 'secondary' },
  { key: 'construction', label: 'Under construction', icon: 'construction', group: 'secondary' },
  { key: 'active', label: 'Active buildings', icon: 'active', group: 'secondary' },
  { key: 'total', label: 'Total buildings', icon: 'total', group: 'secondary' },
];

export function mountGameHud(
  parent: HTMLElement,
  callbacks: GameHudCallbacks,
): UiAdapter<GameHudProjection> {
  const element = document.createElement('section');
  element.className = 'city-awareness-hud';
  element.setAttribute('aria-label', 'City status');

  const primary = document.createElement('div');
  primary.className = 'city-hud-primary';
  const secondary = document.createElement('div');
  secondary.className = 'city-hud-secondary';
  const values = new Map<GameHudMetricId, HTMLElement>();

  for (const definition of metrics) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.setAttribute('role', 'button');
    chip.className = `city-metric city-metric--${definition.group}`;
    chip.dataset.metric = definition.key;
    chip.setAttribute('aria-label', definition.label);
    chip.addEventListener('click', () => callbacks.onSelectMetric(definition.key));
    chip.append(createCityIcon(definition.icon));

    const text = document.createElement('span');
    text.className = 'city-metric-copy';
    const label = document.createElement('span');
    label.className = 'city-metric-label';
    label.textContent = definition.label;
    const value = document.createElement('strong');
    value.className = 'city-metric-value';
    value.dataset.metric = definition.key;
    text.append(label, value);
    chip.append(text);
    values.set(definition.key, value);
    (definition.group === 'primary' ? primary : secondary).append(chip);
  }

  element.append(primary, secondary);
  parent.append(element);

  return Object.freeze({
    element,
    update(projection: GameHudProjection): void {
      for (const definition of metrics) {
        values.get(definition.key)!.textContent = projection[definition.key];
      }
    },
    dispose(): void {
      element.remove();
    },
  });
}
