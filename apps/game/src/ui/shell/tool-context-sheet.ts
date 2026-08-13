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
}

export interface ToolContextSheetCallbacks {
  readonly onUndo?: () => void;
}

export interface ToolContextSheetAdapter extends UiAdapter<ContextualToolProjection> {
  setUndoAvailable(available: boolean): void;
  setStatus(value: string): void;
}

export function mountToolContextSheet(
  parent: HTMLElement,
  callbacks: ToolContextSheetCallbacks = {},
): ToolContextSheetAdapter {
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

  // Transient bootstrap status feed (e.g. save/load results, mutation outcomes).
  // It is a separate line under the tool message; the latest status always shows.
  const status = document.createElement('p');
  status.className = 'city-tool-context-status';
  status.dataset.testid = 'tool-context-status';
  let statusValue: string | null = null;
  let undoAvailableState = false;

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

  const undoPill = (available: boolean): HTMLSpanElement => {
    const pill = document.createElement('span');
    pill.className = 'city-tool-context-pill';
    pill.textContent = available ? 'Undo available' : 'Undo unavailable';
    return pill;
  };

  const undoButton = (available: boolean): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'city-tool-context-undo';
    button.dataset.testid = 'tool-context-undo';
    button.textContent = 'Undo';
    button.disabled = !available;
    button.addEventListener('click', () => callbacks.onUndo?.());
    return button;
  };

  const renderStatus = (): void => {
    if (statusValue !== null) {
      status.textContent = statusValue;
      content.append(status);
    }
  };

  return Object.freeze({
    element,
    update(projection: ContextualToolProjection): void {
      name.textContent = projection.name;
      state.textContent = projection.state;
      const message = document.createElement('p');
      message.className = 'city-tool-context-message';
      message.dataset.testid = 'tool-context-message';
      message.textContent = projection.message;
      const chips: HTMLSpanElement[] = [];
      if (projection.requestedCells !== undefined) {
        const chip = metricChip(`${projection.requestedCells} cells`);
        chip.dataset.testid = 'tool-context-requested';
        chips.push(chip);
      }
      if (projection.effectiveCells !== undefined) {
        const chip = metricChip(`${projection.effectiveCells} effective`);
        chip.dataset.testid = 'tool-context-effective';
        chips.push(chip);
      }
      if (projection.affordability !== undefined) {
        chips.push(metricChip(projection.affordability));
      }
      content.replaceChildren(
        message,
        ...chips,
        undoPill(undoAvailableState),
        undoButton(undoAvailableState),
      );
      renderStatus();
    },
    setUndoAvailable(available: boolean): void {
      undoAvailableState = available;
      const button = content.querySelector<HTMLButtonElement>('[data-testid="tool-context-undo"]');
      const pill = content.querySelector<HTMLElement>('.city-tool-context-pill');
      if (button !== null) button.disabled = !available;
      if (pill !== null) {
        pill.textContent = available ? 'Undo available' : 'Undo unavailable';
      }
    },
    setStatus(value: string): void {
      statusValue = value;
      status.textContent = value;
      content.append(status);
      // A completed mutation status (e.g. "Road built") supersedes the transient
      // "Applying change"/"Undoing" state the tool feed announced before the commit.
      // Mirrors the legacy game-status MutationObserver that reset the tool state
      // to "Ready" after every non-recovery status change.
      if (state.textContent === 'Applying change' || state.textContent === 'Undoing') {
        state.textContent = 'Ready';
      }
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
