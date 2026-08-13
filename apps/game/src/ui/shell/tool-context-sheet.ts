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

export interface ToolContextSheetCallbacks {
  readonly onUndo?: () => void;
}

export interface ToolContextSheetAdapter extends UiAdapter<ContextualToolProjection> {
  setUndoAvailable(available: boolean): void;
  setStatus(value: string): void;
}

function iconName(mode: GameToolMode) {
  if (mode === 'navigate') return 'navigate' as const;
  if (mode === 'raise' || mode === 'lower' || mode === 'flatten') return 'terrain' as const;
  if (mode === 'road-build' || mode === 'road-bulldoze') return 'roads' as const;
  if (mode === 'building-bulldoze') return 'buildings' as const;
  return 'zones' as const;
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
  const icon = document.createElement('span');
  icon.className = 'city-tool-context-icon';
  const name = document.createElement('span');
  name.dataset.testid = 'tool-context-name';
  const state = document.createElement('span');
  state.dataset.testid = 'tool-context-state';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'city-icon-button city-tool-context-toggle';
  toggle.dataset.testid = 'tool-context-toggle';
  toggle.setAttribute('aria-label', 'Toggle tool context');
  toggle.setAttribute('aria-expanded', 'true');
  toggle.append(createCityIcon('chevron-down'));
  header.append(icon, name, state, toggle);

  const content = document.createElement('div');
  content.className = 'city-tool-context-content';
  content.dataset.testid = 'tool-context-content';
  const status = document.createElement('p');
  status.className = 'city-tool-context-status';
  status.dataset.testid = 'tool-context-status';
  let statusValue: string | null = null;
  let undoAvailableState = false;
  element.append(header, content);

  toggle.addEventListener('click', () => {
    const collapsed = !content.hasAttribute('hidden');
    content.toggleAttribute('hidden', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.replaceChildren(createCityIcon(collapsed ? 'chevron-up' : 'chevron-down'));
  });

  const undoPill = (available: booleal): HTMLSpanElement => {
    const pill = document.createElement('span');
    pill.className = 'city-tool-context-pill';
    pill.textContent = available ? 'Undo available' : 'Undo unavailable';
    return pill;
  };

  const undoButton = (available: boolean): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'city-icon-button city-tool-context-undo';
    button.dataset.testid = 'tool-context-undo';
    button.setAttribute('aria-label', 'Undo latest world change');
    button.append(createCityIcon('undo'));
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
      icon.replaceChildren(createCityIcon(iconName(projection.mode)));
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
      if (projection.affordability !== undefined) chips.push(metricChip(projection.affordability));
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
      if (pill !== null) pill.textContent = available ? 'Undo available' : 'Undo unavailable';
    },
    setStatus(value: string): void {
      statusValue = value;
      status.textContent = value;
      content.append(status);
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
