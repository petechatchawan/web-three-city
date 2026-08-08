import type { GameToolMode } from '../../game-tool-mode.js';
import { createButton } from '../components/button.js';

type BuildCategory = 'terrain' | 'roads' | 'zones' | 'buildings';

const tools: Readonly<Record<BuildCategory, ReadonlyArray<readonly [string, GameToolMode]>>> = {
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
    ['Remove', 'zone-remove'],
  ],
  buildings: [['Bulldoze Building', 'building-bulldoze']],
};

export interface BuildDock {
  readonly element: HTMLElement;
  setActiveTool(mode: GameToolMode): void;
  dispose(): void;
}

export function mountBuildDock(
  parent: HTMLElement,
  selectTool: (mode: GameToolMode) => void,
  setTerraformBrush?: (size: 1 | 3 | 5) => void,
): BuildDock {
  const element = document.createElement('nav');
  element.className = 'city-build-dock';
  element.setAttribute('aria-label', 'Build tools');
  const categories = document.createElement('div');
  categories.className = 'city-build-categories';
  const palette = document.createElement('div');
  palette.className = 'city-build-palette';
  let activeMode: GameToolMode = 'navigate';

  const showCategory = (category: BuildCategory): void => {
    palette.replaceChildren();
    for (const [label, mode] of tools[category]) {
      const button = createButton(label, () => {
        activeMode = mode;
        selectTool(mode);
        renderPressed();
      });
      button.dataset.toolMode = mode;
      palette.append(button);
    }
    if (category === 'terrain' && setTerraformBrush !== undefined) {
      for (const size of [1, 3, 5] as const) {
        const button = createButton(`${size} × ${size}`, () => setTerraformBrush(size));
        button.setAttribute('aria-label', `Brush ${size} × ${size}`);
        palette.append(button);
      }
    }
    renderPressed();
  };
  const renderPressed = (): void => {
    for (const button of palette.querySelectorAll<HTMLButtonElement>('[data-tool-mode]')) {
      button.setAttribute('aria-pressed', String(button.dataset.toolMode === activeMode));
    }
  };
  for (const category of Object.keys(tools) as BuildCategory[]) {
    const label = category[0]!.toUpperCase() + category.slice(1);
    const button = createButton(label, () => showCategory(category));
    button.dataset.buildCategory = category;
    categories.append(button);
  }
  element.append(palette, categories);
  parent.append(element);
  return Object.freeze({
    element,
    setActiveTool(mode: GameToolMode): void {
      activeMode = mode;
      renderPressed();
    },
    dispose(): void {
      element.remove();
    },
  });
}
