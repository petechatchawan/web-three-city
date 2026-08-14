import { createCityIcon } from '../components/icon.js';
import type { UiAdapter } from '../foundation/lifecycle.js';
import type { UiLocale } from '../presentation-locale.js';

export interface GameHudProjection {
  readonly population: string;
  readonly treasury: string;
  readonly net: string;
  readonly demand: string;
  readonly residentialDemand: number;
  readonly commercialDemand: number;
  readonly industrialDemand: number;
  readonly gameTime: string;
  readonly construction: string;
  readonly active: string;
  readonly total: string;
}

export type GameHudMetricId = keyof GameHudProjection;

export interface GameHudCallbacks {
  readonly onSelectMetric: (metric: GameHudMetricId) => void;
}

export interface GameHud extends UiAdapter<GameHudProjection> {
  setLocale(locale: UiLocale): void;
}

type DemandKind = 'residential' | 'commercial' | 'industrial';

const demandCopy: Readonly<Record<UiLocale, Readonly<Record<DemandKind, string>>>> = Object.freeze({
  en: Object.freeze({
    residential: 'Residential demand',
    commercial: 'Commercial demand',
    industrial: 'Industrial demand',
  }),
  th: Object.freeze({
    residential: 'ความต้องการที่อยู่อาศัย',
    commercial: 'ความต้องการพาณิชย์',
    industrial: 'ความต้องการอุตสาหกรรม',
  }),
});

function demandLevel(value: number): number {
  return Math.max(0, Math.min(100, Math.round((Math.max(-100, Math.min(100, value)) + 100) / 2)));
}

export function mountGameHud(
  parent: HTMLElement,
  callbacks: GameHudCallbacks,
  initialLocale: UiLocale = 'en',
): GameHud {
  const element = document.createElement('section');
  element.className = 'city-awareness-hud city-mobile-hud';

  let locale = initialLocale;
  const values = new Map<'population' | 'treasury' | 'net' | 'gameTime', HTMLElement>();
  const demandBars = new Map<
    DemandKind,
    Readonly<{ row: HTMLElement; fill: HTMLElement; value: HTMLElement }>
  >();
  let latestProjection: GameHudProjection | null = null;

  const cityValues = document.createElement('button');
  cityValues.type = 'button';
  cityValues.className = 'city-mobile-hud-group city-mobile-hud-group--city';
  cityValues.dataset.metricGroup = 'city-values';
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
  demand.className = 'city-mobile-hud-group city-mobile-hud-group--demand city-rci-demand';
  demand.dataset.metric = 'demand';
  demand.addEventListener('click', () => callbacks.onSelectMetric('demand'));

  for (const [kind, shortLabel] of [
    ['residential', 'R'],
    ['commercial', 'C'],
    ['industrial', 'I'],
  ] as const) {
    const row = document.createElement('span');
    row.className = `city-rci-demand-row city-rci-demand-row--${kind}`;
    row.dataset.rciDemandBar = kind;

    const label = document.createElement('span');
    label.className = 'city-rci-demand-label';
    label.textContent = shortLabel;

    const track = document.createElement('span');
    track.className = 'city-rci-demand-track';
    const fill = document.createElement('span');
    fill.className = 'city-rci-demand-fill';
    track.append(fill);

    const value = document.createElement('span');
    value.className = 'city-rci-demand-value';

    row.append(label, track, value);
    demandBars.set(kind, Object.freeze({ row, fill, value }));
    demand.append(row);
  }

  const time = document.createElement('button');
  time.type = 'button';
  time.className = 'city-mobile-hud-group city-mobile-hud-group--time';
  time.dataset.metric = 'gameTime';
  time.append(createCityIcon('time'));
  const timeValue = document.createElement('strong');
  timeValue.className = 'city-mobile-hud-value city-mobile-hud-value--time';
  time.append(timeValue);
  values.set('gameTime', timeValue);
  time.addEventListener('click', () => callbacks.onSelectMetric('gameTime'));

  const renderLocale = (): void => {
    element.setAttribute('aria-label', locale === 'th' ? 'สถานะเมือง' : 'City status');
    cityValues.setAttribute('aria-label', locale === 'th' ? 'ภาพรวมเมือง' : 'City overview');
    demand.setAttribute('aria-label', locale === 'th' ? 'ความต้องการ RCI' : 'RCI demand');
    time.setAttribute('aria-label', locale === 'th' ? 'เวลาในเกม' : 'Game time');
    if (latestProjection === null) return;
    for (const [kind, projectionKey] of [
      ['residential', 'residentialDemand'],
      ['commercial', 'commercialDemand'],
      ['industrial', 'industrialDemand'],
    ] as const) {
      const value = latestProjection[projectionKey];
      demandBars.get(kind)!.row.setAttribute('aria-label', `${demandCopy[locale][kind]} ${value}`);
    }
  };

  element.append(cityValues, demand, time);
  parent.append(element);
  renderLocale();

  return Object.freeze({
    element,
    setLocale(nextLocale: UiLocale): void {
      locale = nextLocale;
      renderLocale();
    },
    update(projection: GameHudProjection): void {
      latestProjection = projection;
      for (const key of ['population', 'treasury', 'net', 'gameTime'] as const) {
        values.get(key)!.textContent = projection[key];
      }
      for (const [kind, projectionKey] of [
        ['residential', 'residentialDemand'],
        ['commercial', 'commercialDemand'],
        ['industrial', 'industrialDemand'],
      ] as const) {
        const demandValue = projection[projectionKey];
        const bar = demandBars.get(kind)!;
        bar.fill.style.width = `${demandLevel(demandValue)}%`;
        bar.value.textContent = String(demandValue);
        bar.row.dataset.value = String(demandValue);
      }
      renderLocale();
    },
    dispose(): void {
      element.remove();
    },
  });
}
