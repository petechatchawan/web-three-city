import type { GameToolMode } from '../../game-tool-mode.js';
import { createButton } from '../components/button.js';
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
  element.className = 'city-subtool-tray';
  element.dataset.testid = 'subtool-tray';
  element.hidden = true;
  const slot = document.createElement('div');
  slot.className = 'city-subtool-tray-content';
  element.append(slot);
  let activeBrush: 1 | 3 | 5 = 1;
  const renderCategory = (category: TrayCategory): void => {
    slot.replaceChildren();
    for (const [label, mode] of trayTools[category]) {
      const button = createButton(label, () => callbacks.onSelectTool(mode));
      button.dataset.toolMode = mode;
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
    open(category: TrayCategory): void {
      renderCategory(category);
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
