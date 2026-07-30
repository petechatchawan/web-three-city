import type { TerraformBrushSize } from '@web-three-city/terrain-core';
import type { GameToolMode } from './game-tool-mode.js';

export interface GameKeyboardActions {
  readonly selectTool: (mode: GameToolMode) => void;
  readonly selectBrush: (size: TerraformBrushSize) => void;
  readonly requestUndo: () => void;
  readonly cancelPreviewOrCloseTool: () => void;
}

function editableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

export function bindGameKeyboardShortcuts(
  target: Window,
  actions: GameKeyboardActions,
  signal: AbortSignal,
): void {
  const brushOrder: readonly TerraformBrushSize[] = [1, 3, 5];
  let brushIndex = 0;
  target.addEventListener(
    'keydown',
    (event) => {
      if (editableTarget(event.target)) return;

      let consumed = true;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        actions.requestUndo();
      } else {
        switch (event.key) {
          case '1':
            actions.selectTool('raise');
            break;
          case '2':
            actions.selectTool('lower');
            break;
          case '3':
            actions.selectTool('flatten');
            break;
          case '4':
            actions.selectTool('road-build');
            break;
          case '5':
            actions.selectTool('road-bulldoze');
            break;
          case '[':
            brushIndex = Math.max(0, brushIndex - 1);
            actions.selectBrush(brushOrder[brushIndex]!);
            break;
          case ']':
            brushIndex = Math.min(brushOrder.length - 1, brushIndex + 1);
            actions.selectBrush(brushOrder[brushIndex]!);
            break;
          case 'Escape':
            actions.cancelPreviewOrCloseTool();
            break;
          default:
            consumed = false;
        }
      }
      if (consumed) event.preventDefault();
    },
    { signal },
  );
}
