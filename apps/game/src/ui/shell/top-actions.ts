import { createCityIcon, type CityIconName } from '../components/icon.js';

export interface TopActionCallbacks {
  readonly onInformationViews: () => void;
  readonly onCity: () => void;
  readonly onGameMenu: () => void;
}

type ActionDefinition = Readonly<{
  label: string;
  icon: CityIconName;
  callback: keyof TopActionCallbacks;
}>;

const actions: readonly ActionDefinition[] = [
  { label: 'Information Views', icon: 'info', callback: 'onInformationViews' },
  { label: 'City', icon: 'city', callback: 'onCity' },
  { label: 'Game Menu', icon: 'menu', callback: 'onGameMenu' },
];

export function mountTopActions(parent: HTMLElement, callbacks: TopActionCallbacks): HTMLElement {
  const element = document.createElement('nav');
  element.className = 'city-top-actions';
  element.setAttribute('aria-label', 'Game actions');

  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'city-icon-button city-top-action';
    button.setAttribute('aria-label', action.label);
    button.title = action.label;
    button.append(createCityIcon(action.icon));
    const label = document.createElement('span');
    label.className = 'city-sr-only';
    label.textContent = action.label;
    button.append(label);
    button.addEventListener('click', callbacks[action.callback]);
    element.append(button);
  }

  parent.append(element);
  return element;
}
