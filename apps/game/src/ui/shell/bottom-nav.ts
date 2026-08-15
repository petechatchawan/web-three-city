import { createCityIcon, type CityIconName } from '../components/icon.js';
import { uiText, type UiLocale } from '../presentation-locale.js';

export type BottomNavCategory = 'build' | 'city';

export const navCategories: readonly BottomNavCategory[] = ['build', 'city'];

const navIcons: Readonly<Record<BottomNavCategory, CityIconName>> = {
  build: 'buildings',
  city: 'city',
};

export interface BottomNav {
  readonly element: HTMLElement;
  setBuildOpen(open: boolean): void;
  setLocale(locale: UiLocale): void;
  dispose(): void;
}

export function mountBottomNav(
  parent: HTMLElement,
  onSelect: (selection: BottomNavCategory) => void,
  initialLocale: UiLocale = 'en',
): BottomNav {
  const element = document.createElement('nav');
  element.className = 'city-bottom-nav';
  element.setAttribute('aria-label', 'Primary gameplay navigation');

  const primary = document.createElement('div');
  primary.className = 'city-bottom-nav-primary';

  let buildOpen = false;
  let locale = initialLocale;
  const buttons = new Map<BottomNavCategory, HTMLButtonElement>();
  const labels = new Map<BottomNavCategory, HTMLElement>();

  const render = (): void => {
    element.setAttribute(
      'aria-label',
      locale === 'th' ? 'การนำทางหลักของเกม' : 'Primary gameplay navigation',
    );
    for (const category of navCategories) {
      const button = buttons.get(category)!;
      const label = labels.get(category)!;
      const selected = category === 'build' && buildOpen;
      const text = uiText(locale, category);
      button.setAttribute('aria-label', text);
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-active', selected);
      label.textContent = text;
    }
  };

  for (const category of navCategories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'city-nav-item';
    button.dataset.navCategory = category;
    button.dataset.testid = `nav-${category}`;
    button.append(createCityIcon(navIcons[category]));

    const label = document.createElement('span');
    label.className = 'city-nav-label';
    button.append(label);

    button.addEventListener('click', () => {
      if (category === 'build') buildOpen = !buildOpen;
      else buildOpen = false;
      render();
      onSelect(category);
    });

    buttons.set(category, button);
    labels.set(category, label);
    primary.append(button);
  }

  element.append(primary);
  parent.append(element);
  render();

  return Object.freeze({
    element,
    setBuildOpen(open: boolean): void {
      buildOpen = open;
      render();
    },
    setLocale(nextLocale: UiLocale): void {
      locale = nextLocale;
      render();
    },
    dispose(): void {
      element.remove();
    },
  });
}
