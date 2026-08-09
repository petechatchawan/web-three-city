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
    ['Remove Zone', 'zone-remove'],
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
  palette.dataset.testid = 'primary-world-tools';
  let activeMode: GameToolMode = 'navigate';
  let activeBrush: 1 | 3 | 5 = 1;
  const categoryStarts = new Map<BuildCategory, HTMLButtonElement>();
  const navigate = createButton('Navigate', () => {
    activeMode = 'navigate';
    selectTool('navigate');
    renderPressed();
  });
  navigate.dataset.toolMode = 'navigate';
  const closeTool = createButton('Close tool', () => {
    activeMode = 'navigate';
    selectTool('navigate');
    renderPressed();
  });
  closeTool.dataset.testid = 'tool-close';

  const showCategory = (category: BuildCategory): void => {
    categoryStarts.get(category)?.focus({ preventScroll: true });
    categoryStarts.get(category)?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
  };
  const renderPressed = (): void => {
    for (const button of palette.querySelectorAll<HTMLButtonElement>('[data-tool-mode]')) {
      button.setAttribute('aria-pressed', String(button.dataset.toolMode === activeMode));
    }
    closeTool.disabled = activeMode === 'navigate';
    for (const button of palette.querySelectorAll<HTMLButtonElement>('[data-brush-size]')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.brushSize) === activeBrush));
    }
  };
  for (const category of Object.keys(tools) as BuildCategory[]) {
    for (const [label, mode] of tools[category]) {
      const button = createButton(label, () => {
        activeMode = mode;
        selectTool(mode);
        renderPressed();
      });
      button.dataset.toolMode = mode;
      button.dataset.buildGroup = category;
      if (!categoryStarts.has(category)) categoryStarts.set(category, button);
      palette.append(button);
    }
    if (category === 'terrain' && setTerraformBrush !== undefined)
      for (const size of [1, 3, 5] as const) {
        const button = createButton(`${size} × ${size}`, () => {
          activeBrush = size;
          setTerraformBrush(size);
          renderPressed();
        });
        button.setAttribute('aria-label', `Brush ${size} × ${size}`);
        button.dataset.brushSize = String(size);
        button.dataset.buildGroup = category;
        palette.append(button);
      }
  }
  palette.prepend(navigate);
  palette.append(closeTool);
  for (const category of Object.keys(tools) as BuildCategory[]) {
    const label = category[0]!.toUpperCase() + category.slice(1);
    const button = createButton(label, () => showCategory(category));
    button.dataset.buildCategory = category;
    categories.append(button);
  }
  element.append(palette, categories);
  parent.append(element);
  renderPressed();
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
