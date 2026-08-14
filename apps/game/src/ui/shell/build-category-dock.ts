import { createCityIcon } from '../components/icon.js';
import { trayCategories, type TrayCategory } from './subtool-tray.js';

export type BuildCategory = TrayCategory;

export interface BuildCategoryDockCallbacks {
  readonly onSelectCategory: (category: BuildCategory) => void;
  readonly onClose: () => void;
}

export interface BuildCategoryDock {
  readonly element: HTMLElement;
  open(): void;
  close(): void;
  setActiveCategory(category: BuildCategory | null): void;
  dispose(): void;
}

const labels: Readonly<Record<BuildCategory, string>> = {
  terrain: 'Terrain',
  roads: 'Roads',
  zones: 'Zones',
  buildings: 'Buildings',
};

export function mountBuildCategoryDock(
  parent: HTMLElement,
  callbacks: BuildCategoryDockCallbacks,
): BuildCategoryDock {
  const element = document.createElement('nav');
  element.className = 'city-build-category-dock';
  element.dataset.testid = 'build-category-dock';
  element.setAttribute('aria-label', 'Build categories');
  element.hidden = true;

  const buttons = new Map<BuildCategory, HTMLButtonElement>();
  let activeCategory: BuildCategory | null = null;

  const renderPressed = (): void => {
    for (const [category, button] of buttons) {
      const selected = activeCategory === category;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-active', selected);
    }
  };

  for (const category of trayCategories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'city-build-category';
    button.dataset.buildCategory = category;
    button.dataset.testid = `build-category-${category}`;
    button.setAttribute('aria-label', labels[category]);
    button.append(createCityIcon(category));
    const label = document.createElement('span');
    label.textContent = labels[category];
    button.append(label);
    button.addEventListener('click', () => {
      activeCategory = category;
      renderPressed();
      callbacks.onSelectCategory(category);
    });
    buttons.set(category, button);
    element.append(button);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'city-build-category city-build-category--close';
  close.dataset.testid = 'build-close';
  close.setAttribute('aria-label', 'Close Build');
  close.append(createCityIcon('close'));
  const closeLabel = document.createElement('span');
  closeLabel.textContent = 'Close';
  close.append(closeLabel);
  close.addEventListener('click', callbacks.onClose);
  element.append(close);

  parent.append(element);
  renderPressed();

  return Object.freeze({
    element,
    open(): void {
      element.hidden = false;
    },
    close(): void {
      activeCategory = null;
      renderPressed();
      element.hidden = true;
    },
    setActiveCategory(category: BuildCategory | null): void {
      activeCategory = category;
      renderPressed();
    },
    dispose(): void {
      element.remove();
    },
  });
}
