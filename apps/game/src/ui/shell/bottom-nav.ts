import { createCityIcon, type CityIconName } from '../components/icon.js';

export type BuildNavCategory = 'terrain' | 'roads' | 'zones' | 'buildings';
export type BottomNavCategory = BuildNavCategory | 'city';
export type BottomNavSelection = BuildNavCategory | 'city' | null;

export const navCategories: readonly BottomNavCategory[] = [
  'terrain',
  'roads',
  'zones',
  'buildings',
  'city',
];

const navLabels: Readonly<Record<BottomNavCategory, string>> = {
  terrain: 'Terrain',
  roads: 'Roads',
  zones: 'Zones',
  buildings: 'Build',
  city: 'City',
};

const navIcons: Readonly<Record<BottomNavCategory, CityIconName>> = {
  terrain: 'terrain',
  roads: 'roads',
  zones: 'zones',
  buildings: 'buildings',
  city: 'city',
};

export interface BottomNav {
  readonly element: HTMLElement;
  setActiveCategory(category: BuildNavCategory | null): void;
  dispose(): void;
}

export function mountBottomNav(
  parent: HTMLElement,
  onSelect: (selection: BottomNavSelection) => void,
): BottomNav {
  const element = document.createElement('nav');
  element.className = 'city-bottom-nav';
  element.setAttribute('aria-label', 'Primary gameplay navigation');

  const primary = document.createElement('div');
  primary.className = 'city-bottom-nav-primary';

  let activeCategory: BuildNavCategory | null = null;
  const buttons = new Map<BottomNavCategory, HTMLButtonElement>();

  const renderPressed = (): void => {
    for (const [category, button] of buttons) {
      const selected = category !== 'city' && category === activeCategory;
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
    button.append(createCityIcon(navIcons[category]));

    const label = document.createElement('span');
    label.className = 'city-nav-label';
    label.textContent = navLabels[category];
    button.append(label);

    button.addEventListener('click', () => {
      if (category === 'city') {
        onSelect('city');
        renderPressed();
        return;
      }

      if (activeCategory === category) {
        activeCategory = null;
        onSelect(null);
      } else {
        activeCategory = category;
        onSelect(category);
      }
      renderPressed();
    });

    buttons.set(category, button);
    primary.append(button);
  }

  element.append(primary);
  parent.append(element);
  renderPressed();

  return Object.freeze({
    element,
    setActiveCategory(category: BuildNavCategory | null): void {
      activeCategory = category;
      renderPressed();
    },
    dispose(): void {
      element.remove();
    },
  });
}
