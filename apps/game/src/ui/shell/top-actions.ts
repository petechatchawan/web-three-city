import { createButton } from '../components/button.js';

export interface TopActionCallbacks {
  readonly onInformationViews: () => void;
  readonly onCity: () => void;
  readonly onGameMenu: () => void;
}

export function mountTopActions(parent: HTMLElement, callbacks: TopActionCallbacks): HTMLElement {
  const element = document.createElement('nav');
  element.className = 'city-top-actions';
  element.setAttribute('aria-label', 'Game actions');
  element.append(
    createButton('Information Views', callbacks.onInformationViews),
    createButton('City', callbacks.onCity),
    createButton('Game Menu', callbacks.onGameMenu),
  );
  parent.append(element);
  return element;
}
