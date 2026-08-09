import type { GameToolMode } from '../../game-tool-mode.js';
import type { UiAdapter } from '../foundation/lifecycle.js';

export interface ContextualToolProjection {
  readonly mode: GameToolMode;
  readonly name: string;
  readonly state: string;
  readonly message: string;
  readonly requestedCells?: number;
  readonly effectiveCells?: number;
  readonly affordability?: 'Affordable' | 'Unaffordable';
  readonly undoAvailable: boolean;
}

export function mountToolContextSheet(parent: HTMLElement): UiAdapter<ContextualToolProjection> {
  const element = document.createElement('section');
  element.className = 'city-tool-context';
  element.setAttribute('aria-label', 'Active tool');
  parent.append(element);

  const header = document.createElement('div');
  header.className = 'city-tool-context-header';
  const name = document.createElement('span');
  name.dataset.testid = 'tool-context-name';
  const state = document.createElement('span');
  state.dataset.testid = 'tool-context-state';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.dataset.testid = 'tool-context-toggle';
  toggle.setAttribute('aria-label', 'Toggle tool context');
  toggle.setAttribute('aria-expanded', 'true');
  header.append(name, state, toggle);

  const content = document.createElement('div');
  content.className = 'city-tool-context-content';
  content.dataset.testid = 'tool-context-content';

  element.append(header, content);

  toggle.addEventListener('click', () => {
    const collapsed = !content.hasAttribute('hidden');
    if (collapsed) {
      content.setAttribute('hidden', '');
    } else {
      content.removeAttribute('hidden');
    }
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });

  return Object.freeze({
    element,
    update(projection: ContextualToolProjection): void {
      name.textContent = projection.name;
      state.textContent = projection.state;
      const message = document.createElement('p');
      message.className = 'city-tool-context-message';
      message.textContent = projection.message;
      const chips: HTMLSpanElement[] = [];
      if (projection.requestedCells !== undefined) {
        chips.push(metricChip(`${projection.requestedCells} cells`));
      }
      if (projection.effectiveCells !== undefined) {
        chips.push(metricChip(`${projection.effectiveCells} effective`));
      }
      if (projection.affordability !== undefined) {
        chips.push(metricChip(projection.affordability));
      }
      const undo = document.createElement('span');
      undo.className = 'city-tool-context-pill';
      undo.textContent = projection.undoAvailable ? 'Undo available' : 'Undo unavailable';
      content.replaceChildren(message, ...chips, undo);
    },
    dispose(): void {
      element.remove();
    },
  });
}

function metricChip(text: string): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = 'city-tool-context-chip';
  chip.textContent = text;
  return chip;
}
