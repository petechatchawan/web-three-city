import type { GameToolMode } from '../../game-tool-mode.js';
import { createCityIcon } from '../components/icon.js';
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

export interface StatusFeedbackCallbacks {
  readonly onUndo?: () => void;
}

export interface StatusFeedbackAdapter extends UiAdapter<ContextualToolProjection> {
  setUndoAvailable(available: boolean): void;
  setStatus(value: string): void;
  clearStatus(): void;
}

const DISMISS_MS = 3600;

function isMeaningfulProjection(projection: ContextualToolProjection): boolean {
  return (
    projection.state === 'Rejected' ||
    projection.state === 'No change' ||
    projection.state.startsWith('Invalid')
  );
}

export function mountStatusFeedback(
  parent: HTMLElement,
  callbacks: StatusFeedbackCallbacks = {},
): StatusFeedbackAdapter {
  const element = document.createElement('section');
  element.className = 'city-status-feedback';
  element.dataset.testid = 'status-feedback';
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  element.hidden = true;

  const message = document.createElement('span');
  message.className = 'city-status-feedback-message';
  message.dataset.testid = 'tool-context-status';

  let undoAvailable = false;
  let statusValue = '';
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelDismiss = (): void => {
    if (dismissTimer === null) return;
    clearTimeout(dismissTimer);
    dismissTimer = null;
  };

  const render = (): void => {
    element.replaceChildren();
    if (statusValue !== '') element.append(message);
    if (undoAvailable) {
      const undo = document.createElement('button');
      undo.type = 'button';
      undo.className = 'city-status-undo';
      undo.dataset.testid = 'tool-context-undo';
      undo.setAttribute('aria-label', 'Undo latest world change');
      undo.append(createCityIcon('undo'));
      undo.addEventListener('click', () => callbacks.onUndo?.());
      element.append(undo);
    }
    element.hidden = statusValue === '' && !undoAvailable;
  };

  const scheduleDismiss = (): void => {
    cancelDismiss();
    if (statusValue === '') return;
    dismissTimer = setTimeout(() => {
      statusValue = '';
      message.textContent = '';
      dismissTimer = null;
      render();
    }, DISMISS_MS);
  };

  parent.append(element);
  render();

  return Object.freeze({
    element,
    update(projection: ContextualToolProjection): void {
      if (!isMeaningfulProjection(projection)) return;
      statusValue = projection.message;
      message.textContent = projection.message;
      render();
      scheduleDismiss();
    },
    setUndoAvailable(available: boolean): void {
      undoAvailable = available;
      render();
    },
    setStatus(value: string): void {
      statusValue = value.trim();
      message.textContent = statusValue;
      render();
      scheduleDismiss();
    },
    clearStatus(): void {
      cancelDismiss();
      statusValue = '';
      message.textContent = '';
      render();
    },
    dispose(): void {
      cancelDismiss();
      element.remove();
    },
  });
}
