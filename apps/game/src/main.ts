import './style.css';
import { bootstrapGame } from './game-bootstrap.js';
import { bindGameKeyboardShortcuts } from './game-keyboard-shortcuts.js';
import type { GameToolMode } from './game-tool-mode.js';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) throw new Error('game:missing-root');
const runtime = bootstrapGame(root);

function requireButton(action: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
  if (button === null) throw new Error(`game:missing-action:${action}`);
  return button;
}

const toolActions: Readonly<Record<GameToolMode, string>> = Object.freeze({
  navigate: 'tool-navigate',
  raise: 'tool-raise',
  lower: 'tool-lower',
  flatten: 'tool-flatten',
  'road-build': 'tool-road-build',
  'road-bulldoze': 'tool-road-bulldoze',
});
const brushActions = Object.freeze({ 1: 'brush-1', 3: 'brush-3', 5: 'brush-5' });
const navigateButton = requireButton('tool-navigate');
const closeToolButton = requireButton('tool-close');
const undoButton = requireButton('undo');
const bindings = new AbortController();

closeToolButton.addEventListener('click', () => navigateButton.click(), {
  signal: bindings.signal,
});

bindGameKeyboardShortcuts(
  window,
  {
    selectTool: (mode) => requireButton(toolActions[mode]).click(),
    selectBrush: (size) => requireButton(brushActions[size]).click(),
    requestUndo: () => undoButton.click(),
    cancelPreviewOrCloseTool: () => navigateButton.click(),
  },
  bindings.signal,
);

document.addEventListener(
  'visibilitychange',
  () => {
    if (document.visibilityState === 'hidden') navigateButton.click();
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
