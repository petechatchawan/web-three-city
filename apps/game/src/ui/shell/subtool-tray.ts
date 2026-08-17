import type { RoadDefinitionId } from '@web-three-city/road-core';
import type { GameToolMode } from '../../game-tool-mode.js';
import { createCityIcon, type CityIconName } from '../components/icon.js';
import { uiText, type UiCopyKey, type UiLocale } from '../presentation-locale.js';
import { mountBrushSelector, type BrushSelector } from './brush-stepper.js';

export type TrayCategory = 'terrain' | 'roads' | 'zones' | 'buildings';
export const trayCategories: readonly TrayCategory[] = ['terrain', 'roads', 'zones', 'buildings'];

type TrayToolEntry = readonly [UiCopyKey, GameToolMode, RoadDefinitionId?];

const trayTools: Readonly<Record<TrayCategory, readonly TrayToolEntry[]>> = {
  terrain: [
    ['raise', 'raise'],
    ['lower', 'lower'],
    ['flatten', 'flatten'],
  ],
  roads: [
    ['localStreet', 'road-build', 'basic-road'],
    ['collectorRoad', 'road-build-collector', 'collector-road'],
    ['arterialRoad', 'road-build-arterial', 'arterial-road'],
    ['bulldozeRoad', 'road-bulldoze'],
  ],
  zones: [
    ['residential', 'zone-residential'],
    ['commercial', 'zone-commercial'],
    ['industrial', 'zone-industrial'],
    ['removeZone', 'zone-remove'],
  ],
  buildings: [['bulldozeBuilding', 'building-bulldoze']],
};

const categoryIcons: Readonly<Record<TrayCategory, CityIconName>> = {
  terrain: 'terrain',
  roads: 'roads',
  zones: 'zones',
  buildings: 'buildings',
};

const toolIcons: Readonly<Record<GameToolMode, CityIconName>> = {
  navigate: 'navigate',
  raise: 'raise',
  lower: 'lower',
  flatten: 'flatten',
  'road-build': 'roads',
  'road-build-collector': 'roads',
  'road-build-arterial': 'roads',
  'road-bulldoze': 'remove',
  'zone-residential': 'residential',
  'zone-commercial': 'commercial',
  'zone-industrial': 'industrial',
  'zone-remove': 'remove',
  'building-bulldoze': 'remove',
};

const semanticClass: Partial<Record<GameToolMode, string>> = {
  'zone-residential': 'city-tool-pill--residential',
  'zone-commercial': 'city-tool-pill--commercial',
  'zone-industrial': 'city-tool-pill--industrial',
  'zone-remove': 'city-tool-pill--remove',
};

export interface SubToolTrayCallbacks {
  readonly onSelectTool: (mode: GameToolMode) => void;
  readonly onBrush?: (size: 1 | 3 | 5) => void;
  readonly onClose?: () => void;
}

export interface SubToolTray {
  readonly element: HTMLElement;
  readonly categories: Readonly<Record<TrayCategory, readonly TrayToolEntry[]>>;
  open(category?: TrayCategory): void;
  close(): void;
  setLocale(locale: UiLocale): void;
  dispose(): void;
}

export function mountSubToolTray(
  parent: HTMLElement,
  callbacks: SubToolTrayCallbacks,
  initialLocale: UiLocale = 'en',
): SubToolTray {
  const element = document.createElement('section');
  element.className = 'city-contextual-tool-dock city-subtool-tray city-build-picker';
  element.dataset.testid = 'build-picker';
  element.hidden = true;
  element.setAttribute('aria-label', 'Build tools');

  const slot = document.createElement('div');
  slot.className = 'city-contextual-tool-dock-content city-subtool-tray-content';
  element.append(slot);

  let activeBrush: 1 | 3 | 5 = 1;
  let locale = initialLocale;
  let currentCategory: TrayCategory | null = null;

  const close = (): void => {
    slot.replaceChildren();
    element.hidden = true;
    currentCategory = null;
    delete element.dataset.category;
    callbacks.onClose?.();
  };

  const renderCategories = (): void => {
    slot.replaceChildren();
    currentCategory = null;
    delete element.dataset.category;
    element.setAttribute('aria-label', locale === 'th' ? 'เครื่องมือสร้าง' : 'Build tools');
    for (const category of trayCategories) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'city-build-category';
      button.dataset.testid = `build-category-${category}`;
      button.dataset.buildCategory = category;
      const label = uiText(locale, category);
      button.setAttribute('aria-label', label);
      button.append(createCityIcon(categoryIcons[category]));
      const text = document.createElement('span');
      text.textContent = label;
      button.append(text);
      button.addEventListener('click', () => renderCategory(category));
      slot.append(button);
    }
  };

  const renderCategory = (category: TrayCategory): void => {
    slot.replaceChildren();
    currentCategory = category;
    element.dataset.category = category;

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'city-build-picker-back';
    back.setAttribute(
      'aria-label',
      locale === 'th' ? 'กลับไปหมวดเครื่องมือ' : 'Back to build categories',
    );
    back.append(createCityIcon('chevron-down'));
    const backText = document.createElement('span');
    backText.textContent = uiText(locale, category);
    back.append(backText);
    back.addEventListener('click', renderCategories);
    slot.append(back);

    for (const [labelKey, mode, roadDefinitionId] of trayTools[category]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'city-tool-pill';
      const semantic = semanticClass[mode];
      if (semantic !== undefined) button.classList.add(semantic);
      button.dataset.toolMode = mode;
      if (roadDefinitionId !== undefined) button.dataset.roadDefinition = roadDefinitionId;
      const label = uiText(locale, labelKey);
      button.setAttribute('aria-label', label);
      button.append(createCityIcon(toolIcons[mode]));
      const text = document.createElement('span');
      text.className = 'city-tool-label';
      text.textContent = label;
      button.append(text);
      button.addEventListener('click', () => {
        callbacks.onSelectTool(mode);
        close();
      });
      slot.append(button);
    }

    if (category === 'terrain' && callbacks.onBrush !== undefined) {
      const brush = mountBrushSelector(slot, (size) => {
        activeBrush = size;
        callbacks.onBrush?.(size);
      });
      brush.setBrush(activeBrush);
    }
  };

  parent.append(element);
  return Object.freeze({
    element,
    categories: trayTools,
    open(category?: TrayCategory): void {
      element.hidden = false;
      if (category === undefined) renderCategories();
      else renderCategory(category);
    },
    close,
    setLocale(nextLocale: UiLocale): void {
      locale = nextLocale;
      if (!element.hidden) {
        if (currentCategory === null) renderCategories();
        else renderCategory(currentCategory);
      }
    },
    dispose(): void {
      element.remove();
    },
  });
}

export type { BrushSelector };
