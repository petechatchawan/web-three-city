import { createDialogNavigation, type PrimaryDialogRoute } from './dialog-navigation.js';

export type DialogRenderer = (body: HTMLElement) => void;

export interface DialogHost {
  readonly element: HTMLElement;
  readonly activeRoute: PrimaryDialogRoute | null;
  open(route: PrimaryDialogRoute, render: DialogRenderer): void;
  push(route: PrimaryDialogRoute, render: DialogRenderer): void;
  back(): void;
  close(): void;
  update(): void;
  refresh(): void;
  dispose(): void;
}

export function mountDialogHost(parent: HTMLElement): DialogHost {
  const navigation = createDialogNavigation();
  const element = document.createElement('div');
  element.className = 'city-dialog-backdrop';
  element.dataset.worldInputBlock = '';
  element.hidden = true;
  const dialog = document.createElement('section');
  dialog.className = 'city-sheet';
  dialog.dataset.sheet = '90vh';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  const handle = document.createElement('div');
  handle.className = 'city-sheet-handle';
  handle.setAttribute('aria-hidden', 'true');
  const header = document.createElement('header');
  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.textContent = 'Back';
  const title = document.createElement('h2');
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', 'Close');
  const body = document.createElement('div');
  body.className = 'city-sheet-body';
  header.append(backButton, title, closeButton);
  dialog.append(handle, header, body);
  element.append(dialog);
  parent.append(element);

  const renderers: DialogRenderer[] = [];
  let restoreFocus: HTMLElement | null = null;
  const abortController = new AbortController();
  const listenerOptions = { signal: abortController.signal };

  const renderActive = (moveFocus = false): void => {
    const route = navigation.active();
    element.hidden = route === null;
    if (route === null) return;
    title.textContent = route.title;
    body.replaceChildren();
    renderers.at(-1)?.(body);
    if (moveFocus) closeButton.focus();
  };

  const refreshLive = (): void => {
    if (navigation.active()?.live === true) renderActive(false);
  };

  const close = (): void => {
    navigation.close();
    renderers.length = 0;
    element.hidden = true;
    restoreFocus?.focus();
    restoreFocus = null;
  };

  const host: DialogHost = {
    element,
    get activeRoute() {
      return navigation.active();
    },
    open(route, render): void {
      if (navigation.active() === null) {
        restoreFocus =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
      navigation.open(route);
      renderers.splice(0, renderers.length, render);
      renderActive(true);
    },
    push(route, render): void {
      navigation.push(route);
      renderers.push(render);
      renderActive(true);
    },
    back(): void {
      const route = navigation.back();
      renderers.pop();
      if (route === null) close();
      else renderActive(true);
    },
    close,
    update: refreshLive,
    refresh: () => renderActive(false),
    dispose(): void {
      abortController.abort();
      close();
      element.remove();
    },
  };

  backButton.addEventListener('click', () => host.back(), listenerOptions);
  closeButton.addEventListener('click', close, listenerOptions);
  element.addEventListener('pointerdown', (event) => event.stopPropagation(), listenerOptions);
  element.addEventListener(
    'click',
    (event) => {
      if (event.target === element && navigation.active() !== null) close();
    },
    listenerOptions,
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && navigation.active() !== null) close();
    },
    listenerOptions,
  );
  return Object.freeze(host);
}
