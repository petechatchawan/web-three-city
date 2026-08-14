import { createCityIcon } from '../components/icon.js';

export interface PrimaryActionCallbacks {
  readonly onNavigate: () => void;
  readonly onToggleBuild: () => void;
}

export interface PrimaryActions {
  readonly element: HTMLElement;
  setBuildOpen(open: boolean): void;
  dispose(): void;
}

export function mountPrimaryActions(
  parent: HTMLElement,
  callbacks: PrimaryActionCallbacks,
): PrimaryActions {
  const element = document.createElement('nav');
  element.className = 'city-primary-actions';
  element.setAttribute('aria-label', 'Primary city actions');

  const navigate = document.createElement('button');
  navigate.type = 'button';
  navigate.className = 'city-primary-action city-primary-action--navigate';
  navigate.dataset.testid = 'primary-navigate';
  navigate.setAttribute('aria-label', 'Navigate');
  navigate.append(createCityIcon('navigate'));
  const navigateLabel = document.createElement('span');
  navigateLabel.textContent = 'Navigate';
  navigate.append(navigateLabel);
  navigate.addEventListener('click', callbacks.onNavigate);

  const build = document.createElement('button');
  build.type = 'button';
  build.className = 'city-build-cta';
  build.dataset.testid = 'build-cta';
  build.setAttribute('aria-label', 'Build');
  build.setAttribute('aria-expanded', 'false');
  build.append(createCityIcon('construction'));
  const buildLabel = document.createElement('span');
  buildLabel.textContent = 'Build';
  build.append(buildLabel);
  build.addEventListener('click', callbacks.onToggleBuild);

  element.append(navigate, build);
  parent.append(element);

  return Object.freeze({
    element,
    setBuildOpen(open: boolean): void {
      build.setAttribute('aria-expanded', String(open));
      build.classList.toggle('is-active', open);
    },
    dispose(): void {
      element.remove();
    },
  });
}
