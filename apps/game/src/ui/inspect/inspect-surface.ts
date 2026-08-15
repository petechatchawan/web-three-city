import type { InspectProjection } from './inspect-projections.js';
import {
  localizeInspectFieldLabel,
  localizeInspectTitle,
  uiText,
  type UiLocale,
} from '../presentation-locale.js';

export interface InspectSurface {
  readonly element: HTMLElement;
  open(projection: InspectProjection): void;
  update(projection: InspectProjection): void;
  collapse(): void;
  close(): void;
  setLocale(locale: UiLocale): void;
  dispose(): void;
}

export function mountInspectSurface(
  parent: HTMLElement,
  initialLocale: UiLocale = 'en',
): InspectSurface {
  const element = document.createElement('aside');
  element.className = 'city-inspect-surface';
  element.dataset.testid = 'inspect-surface';
  element.dataset.expanded = 'false';
  element.hidden = true;
  element.setAttribute('aria-live', 'polite');

  let latest: InspectProjection | null = null;
  let expanded = false;
  let locale = initialLocale;

  const render = (): void => {
    element.replaceChildren();
    element.dataset.expanded = String(expanded);
    if (latest === null) {
      element.hidden = true;
      return;
    }

    element.hidden = false;
    const header = document.createElement('div');
    header.className = 'city-inspect-header';

    const identity = document.createElement('div');
    identity.className = 'city-inspect-identity';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'city-inspect-eyebrow';
    eyebrow.textContent = uiText(locale, 'inspect');
    const title = document.createElement('strong');
    title.className = 'city-inspect-title';
    title.textContent = localizeInspectTitle(locale, latest.title);
    const firstField = latest.fields?.[0];
    const summary = document.createElement('span');
    summary.className = 'city-inspect-summary';
    summary.textContent =
      firstField === undefined
        ? ''
        : `${localizeInspectFieldLabel(locale, firstField.label)}: ${firstField.value}`;
    identity.append(eyebrow, title, summary);

    const actions = document.createElement('div');
    actions.className = 'city-inspect-actions';

    const expand = document.createElement('button');
    expand.type = 'button';
    expand.className = 'city-inspect-action';
    expand.setAttribute(
      'aria-label',
      uiText(locale, expanded ? 'collapseInspect' : 'expandInspect'),
    );
    expand.setAttribute('aria-expanded', String(expanded));
    expand.textContent = expanded ? '−' : '+';
    expand.addEventListener('click', () => {
      expanded = !expanded;
      render();
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'city-inspect-action';
    close.setAttribute('aria-label', uiText(locale, 'closeInspect'));
    close.textContent = '×';
    close.addEventListener('click', () => {
      latest = null;
      expanded = false;
      render();
    });

    actions.append(expand, close);
    header.append(identity, actions);
    element.append(header);

    if (!expanded) return;

    const body = document.createElement('div');
    body.className = 'city-inspect-body';
    for (const field of latest.fields ?? []) {
      const row = document.createElement('p');
      row.className = 'city-inspect-row';
      const label = document.createElement('span');
      label.textContent = localizeInspectFieldLabel(locale, field.label);
      const value = document.createElement('strong');
      value.textContent = field.value;
      row.append(label, value);
      body.append(row);
    }
    element.append(body);
  };

  parent.append(element);
  render();

  return Object.freeze({
    element,
    open(projection: InspectProjection): void {
      if (latest === null) expanded = false;
      latest = projection;
      render();
    },
    update(projection: InspectProjection): void {
      latest = projection;
      render();
    },
    collapse(): void {
      if (latest === null || !expanded) return;
      expanded = false;
      render();
    },
    close(): void {
      latest = null;
      expanded = false;
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
