import { createButton } from '../components/button.js';

export type NavCategory = 'navigate' | 'terrain' | 'roads' | 'zones' | 'buildings';

export const navCategories: readonly NavCategory[] = [
  'navigate',
  'terrain',
  'roads',
  'zones',
  'buildings',
];

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
    for (const [category, button] of buttons)
      button.setAttribute('aria-pressed', String(category === activeCategory));
  };
  for (const category of navCategories) {
    const button = createButton(category[0]!.toUpperCase() + category.slice(1), () => {
      activeCategory = category;
      onSelect(category);
      renderPressed();
    });
    button.dataset.navCategory = category;
    button.dataset.testid = `nav-${category}`;
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
