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
const ROUTINE_HELPER = 'Point at the world to preview this tool';

function isMeaningfulValidation(projection: ContextualToolProjection): boolean {
  return (
    projection.state === 'Rejected' ||
    projection.state === 'No change' ||
    projection.state.startsWith('Invalid')
  );
}

function isRoutineMessage(value: string): boolean {
  return value.trim().startsWith(ROUTINE_HELPER);
}

function detailRow(labelText: string, valueText: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'city-tool-context-detail';
  const label = document.createElement('span');
  label.textContent = labelText;
  const value = document.createElement('strong');
  value.textContent = valueText;
  row.append(label, value);
  return row;
}

function statusForProjection(projection: ContextualToolProjection | null): string {
  if (projection === null) return '';
  if (
    isMeaningfulValidation(projection) &&
    projection.message.trim() !== '' &&
    !isRoutineMessage(projection.message)
  ) {
    return projection.message;
  }
  return projection.state;
}

export function mountStatusFeedback(
  parent: HTMLElement,
  callbacks: StatusFeedbackCallbacks = {},
): StatusFeedbackAdapter {
  const element = document.createElement('section');
  element.className = 'city-tool-context-sheet city-status-feedback';
  element.dataset.testid = 'status-feedback';
  element.dataset.expanded = 'false';
  element.setAttribute('aria-live', 'polite');
  element.hidden = true;

  let latestProjection: ContextualToolProjection | null = null;
  let latestMode: GameToolMode | null = null;
  let expanded = false;
  let undoAvailable = false;
  let transientStatus = '';
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelDismiss = (): void => {
    if (dismissTimer === null) return;
    clearTimeout(dismissTimer);
    dismissTimer = null;
  };

  const hasActiveTool = (): boolean =>
    latestProjection !== null && latestProjection.mode !== 'navigate';

  const render = (): void => {
    element.replaceChildren();
    element.dataset.expanded = String(expanded);

    const active = hasActiveTool();
    if (!active && transientStatus === '') {
      element.hidden = true;
      return;
    }

    const projection = active ? latestProjection : null;
    element.hidden = false;

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'city-tool-context-header';
    header.dataset.testid = 'tool-context-toggle';
    header.setAttribute('aria-label', 'Tool Context');
    header.setAttribute('aria-expanded', String(expanded));
    header.disabled = projection === null;

    const identity = document.createElement('span');
    identity.className = 'city-tool-context-identity';
    const name = document.createElement('strong');
    name.className = 'city-tool-context-name';
    name.textContent = projection?.name ?? 'World';
    identity.append(name);

    const status = document.createElement('span');
    status.className = 'city-tool-context-status';
    status.dataset.testid = 'tool-context-status';
    status.textContent = transientStatus || statusForProjection(projection);

    header.append(identity, status);
    if (projection !== null)
      header.append(createCityIcon(expanded ? 'chevron-down' : 'chevron-up'));
    header.addEventListener('click', () => {
      if (projection === null) return;
      expanded = !expanded;
      render();
    });
    element.append(header);

    if (
      expanded &&
      projection !== null &&
      isMeaningfulValidation(projection) &&
      projection.message.trim() !== '' &&
      !isRoutineMessage(projection.message)
    ) {
      const validation = document.createElement('p');
      validation.className = 'city-tool-context-validation';
      validation.textContent = projection.message;
      element.append(validation);
    }

    if (!expanded || projection === null) return;

    const body = document.createElement('div');
    body.className = 'city-tool-context-body';
    if (projection.requestedCells !== undefined) {
      body.append(detailRow('Requested cells', String(projection.requestedCells)));
    }
    if (projection.effectiveCells !== undefined) {
      body.append(detailRow('Effective cells', String(projection.effectiveCells)));
    }
    if (projection.affordability !== undefined) {
      body.append(detailRow('Affordability', projection.affordability));
    }

    if (undoAvailable) {
      const undo = document.createElement('button');
      undo.type = 'button';
      undo.className = 'city-tool-context-undo city-status-undo';
      undo.dataset.testid = 'tool-context-undo';
      undo.setAttribute('aria-label', 'Undo latest world change');
      undo.append(createCityIcon('undo'));
      const label = document.createElement('span');
      label.textContent = 'Undo';
      undo.append(label);
      undo.addEventListener('click', () => callbacks.onUndo?.());
      body.append(undo);
    }

    element.append(body);
  };

  const clearStatus = (): void => {
    cancelDismiss();
    transientStatus = '';
    render();
  };

  const scheduleDismiss = (): void => {
    cancelDismiss();
    if (transientStatus === '') return;
    dismissTimer = setTimeout(() => {
      transientStatus = '';
      dismissTimer = null;
      render();
    }, DISMISS_MS);
  };

  parent.append(element);
  render();

  return Object.freeze({
    element,
    update(projection: ContextualToolProjection): void {
      if (latestMode !== projection.mode) expanded = false;
      latestMode = projection.mode;
      latestProjection = projection;
      if (projection.mode === 'navigate') {
        expanded = false;
        transientStatus = '';
        cancelDismiss();
      }
      render();
    },
    setUndoAvailable(available: boolean): void {
      undoAvailable = available;
      render();
    },
    setStatus(value: string): void {
      const normalized = value.trim();
      if (normalized === '') {
        clearStatus();
        return;
      }
      if (normalized === 'Ready') {
        transientStatus = '';
        cancelDismiss();
        render();
        return;
      }
      transientStatus = normalized;
      render();
      scheduleDismiss();
    },
    clearStatus,
    dispose(): void {
      cancelDismiss();
      element.remove();
    },
  });
}
