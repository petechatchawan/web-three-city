import type { GameToolMode } from '../../game-tool-mode.js';
import { createCityIcon, type CityIconName } from '../components/icon.js';
import { mountBrushSelector, type BrushSelector } from './brush-stepper.js';

export type TrayCategory = 'terrain' | 'roads' | 'zones' | 'buildings';
export const trayCategories: readonly TrayCategory[] = ['terrain', 'roads', 'zones', 'buildings'];

const trayTools: Readonly<Record<TrayCategory, ReadonlyArray<readonly [string, GameToolMode]>>> = {
  terrain: [
    ['Raise', 'raise'],
    ['Lower', 'lower'],
    ['Flatten', 'flatten'],
  ],
  roads: [
    ['Build Road', 'road-build'],
    ['Bulldoze Road', 'road-bulldoze'],
  ],
  zones: [
    ['Residential', 'zone-residential'],
    ['Commercial', 'zone-commercial'],
    ['Industrial', 'zone-industrial'],
    ['Remove Zone', 'zone-remove'],
  ],
  buildings: [['Bulldoze Building', 'building-bulldoze']],
};

const toolIcons: Readonly<Record<GameToolMode, CityIconName>> = {
  navigate: 'navigate',
  raise: 'raise',
  lower: 'lower',
  flatten: 'flatten',
  'road-build': 'roads',
  'road-bulldoze': 'remove',
  'zone-residential': 'residential',
  'zone-commercial': 'commercial',
  'zone-industrial': 'industrial',
  'zone-remove': 'remove',
  'building-bulldoze': 'remove',
};

export interface SubToolTrayCallbacks {
  readonly onSelectTool: (mode: GameToolMode) => void;
  readonly onBrush?: (size: 1 | 3 | 5) => void;
}

export interface SubToolTray {
  readonly element: HTMLElement;
  readonly categories: Readonly<
    Record<TrayCategory, ReadonlyArray<readonly [string, GameToolMode]>>
  >;
  open(category: TrayCategory): void;
  close(): void;
  dispose(): void;
}

export function mountSubToolTray(
  parent: HTMLElement,
  callbacks: SubToolTrayCallbacks,
): SubToolTray {
  const element = document.createElement('div');
  element.className = 'city-contextual-tool-dock city-subtool-tray';
  element.dataset.testid = 'subtool-tray';
  element.hidden = true;
  const slot = document.createElement('div');
  slot.className = 'city-contextual-tool-dock-content city-subtool-tray-content';
  element.append(slot);
  let activeBrush: 1 | 3 | 5 = 1;
  let activeMode: GameToolMode | null = null;

  const selectVisual = (mode: GameToolMode): void => {
    activeMode = mode;
    for (const button of slot.querySelectorAll<HTMLButtonElement>('[data-tool-mode]')) {
      const selected = button.dataset.toolMode === mode;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-active', selected);
    }
  };

  const renderCategory = (category: TrayCategory): void => {
    slot.replaceChildren();
    const tools = trayTools[category];
    if (!tools.some(([, mode]) => mode === activeMode)) activeMode = tools[0]?.[1] ?? null;
    for (const [label, mode] of tools) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'city-tool-pill';
      button.dataset.toolMode = mode;
      button.setAttribute('aria-label', label);
      button.append(createCityIcon(toolIcons[mode]));
      const text = document.createElement('span');
      text.className = 'city-tool-label';
      text.textContent = label;
      button.append(text);
      button.addEventListener('click', () => {
        selectVisual(mode);
        callbacks.onSelectTool(mode);
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
    if (activeMode !== null) selectVisual(activeMode);
  };

  parent.append(element);
  return Object.freeze({
    element,
    categories: trayTools,
    open(category: TrayCategory): void {
      renderCategory(category);
      element.dataset.category = category;
      element.hidden = false;
    },
    close(): void {
      slot.replaceChildren();
      element.hidden = true;
    },
    dispose(): void {
      element.remove();
    },
  });
}

export type { BrushSelector };
