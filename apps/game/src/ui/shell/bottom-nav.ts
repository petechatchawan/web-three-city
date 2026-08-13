import { createCityIcon } from '../components/icon.js';

export type NavCategory = 'navigate' | 'terrain' | 'roads' | 'zones' | 'buildings';

export const navCategories: readonly NavCategory[] = [
  'navigate',
  'terrain',
  'roads',
  'zones',
  'buildings',
];

const navLabels: Readonly<Record<NavCategory, string>> = {
  navigate: 'Navigate',
  terrain: 'Terrain',
  roads: 'Roads',
  zones: 'Zones',
  buildings: 'Buildings',
};

export interface BottomNav {
  readonly element: HTMLElement;
  setActiveCategory(category: NavCategory): void;
  dispose(): void;
}

export function mountBottomNav(
  parent: HTMLElement,
  onSelect: (category: NavCategory) => void,
): BottomNav {
  const element = document.createElement('nav');
  element.className = 'city-bottom-nav';
  element.setAttribute('aria-label', 'City build categories');
  let activeCategory: NavCategory = 'navigate';
  const buttons = new Map<NavCategory, HTMLButtonElement>();

  const renderPressed = (): void => {
    for (const [category, button] of buttons) {
      const selected = category === activeCategory;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-active', selected);
    }
  };

  for (const category of navCategories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'city-nav-item';
    button.dataset.navCategory = category;
    button.dataset.testid = `nav-${category}`;
    button.setAttribute('aria-label', navLabels[category]);
    button.append(createCityIcon(category));
    const label = document.createElement('span');
    label.className = 'city-nav-label';
    label.textContent = navLabels[category];
    button.append(label);
    button.addEventListener('click', () => {
      activeCategory = category;
      onSelect(category);
      renderPressed();
    });
    buttons.set(category, button);
    element.append(button);
  }

  parent.append(element);
  renderPressed();

  return Object.freeze({
    element,
    setActiveCategory(category: NavCategory): void {
      activeCategory = category;
      renderPressed();
    },
    dispose(): void {
      element.remove();
    },
  });
}
