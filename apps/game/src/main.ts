import './style.css';
import type { TerraformBrushSize } from '@web-three-city/terrain-core';
import { bootstrapGame } from './game-bootstrap.js';
import { bindGameKeyboardShortcuts } from './game-keyboard-shortcuts.js';
import { dispatchGameToolCancel, dispatchGameTransactionState } from './game-tool-events.js';
import { bindGameToolHud } from './game-tool-hud-binding.js';
import type { GameToolMode } from './game-tool-mode.js';
import { expandGameSecondaryControls } from './game-secondary-controls.js';
import { undoTransaction } from './game-transaction-presentation.js';

const rootElement = document.querySelector<HTMLElement>('#app');
if (rootElement === null) throw new Error('game:missing-root');
const root: HTMLElement = rootElement;
const runtime = bootstrapGame(root);

function requireButton(action: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
  if (button === null) throw new Error(`game:missing-action:${action}`);
  return button;
}

const canvasElement = root.querySelector<HTMLCanvasElement>('#game-canvas');
if (canvasElement === null) throw new Error('game:missing-canvas');
const canvas: HTMLCanvasElement = canvasElement;
const toolActions: Readonly<Record<GameToolMode, string>> = Object.freeze({
  navigate: 'tool-navigate',
  raise: 'tool-raise',
  lower: 'tool-lower',
  flatten: 'tool-flatten',
  'road-build': 'tool-road-build',
  'road-bulldoze': 'tool-road-bulldoze',
  'zone-residential': 'tool-zone-residential',
  'zone-commercial': 'tool-zone-commercial',
  'zone-industrial': 'tool-zone-industrial',
  'zone-remove': 'tool-zone-remove',
});
const brushActions = Object.freeze({ 1: 'brush-1', 3: 'brush-3', 5: 'brush-5' });
const navigateButton = requireButton('tool-navigate');
const closeToolButton = requireButton('tool-close');
const undoButton = requireButton('undo');
const bindings = new AbortController();

function currentBrush(): TerraformBrushSize {
  for (const size of [1, 3, 5] as const) {
    if (requireButton(brushActions[size]).getAttribute('aria-pressed') === 'true') return size;
  }
  return 1;
}

function cancelPreviewOrCloseTool(): void {
  const evidence = window.__WEB_THREE_CITY_INTERACTION__;
  if (evidence?.terraform.strokeActive === true || evidence?.road.strokeActive === true) {
    dispatchGameToolCancel(canvas);
  } else {
    navigateButton.click();
  }
}

function dispatchUndoTransaction(): void {
  const transaction = undoTransaction(window.__WEB_THREE_CITY_INTERACTION__);
  if (transaction === null) return;
  dispatchGameTransactionState(canvas, transaction.state, transaction.domain);
}

expandGameSecondaryControls(root);
window.dispatchEvent(new Event('resize'));
bindGameToolHud(root, canvas, bindings.signal);
closeToolButton.addEventListener('click', () => navigateButton.click(), {
  signal: bindings.signal,
});
undoButton.addEventListener('click', dispatchUndoTransaction, {
  capture: true,
  signal: bindings.signal,
});

bindGameKeyboardShortcuts(
  window,
  {
    selectTool: (mode) => requireButton(toolActions[mode]).click(),
    getBrush: currentBrush,
    selectBrush: (size) => requireButton(brushActions[size]).click(),
    requestUndo: () => undoButton.click(),
    cancelPreviewOrCloseTool,
  },
  bindings.signal,
);

document.addEventListener(
  'visibilitychange',
  () => {
    if (document.visibilityState === 'hidden') dispatchGameToolCancel(canvas);
  },
  { signal: bindings.signal },
);

window.addEventListener(
  'pagehide',
  () => {
    bindings.abort();
    runtime.dispose();
  },
  { once: true },
);
