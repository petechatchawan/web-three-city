import type { TerraformBrushSize } from '@web-three-city/terrain-core';
import type { GameToolMode } from './game-tool-mode.js';

export interface GameKeyboardActions {
  readonly selectTool: (mode: GameToolMode) => void;
  readonly getBrush: () => TerraformBrushSize;
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
  const selectRelativeBrush = (offset: -1 | 1): void => {
    const currentIndex = Math.max(0, brushOrder.indexOf(actions.getBrush()));
    const nextIndex = Math.min(
      brushOrder.length - 1,
      Math.max(0, currentIndex + offset),
    );
    actions.selectBrush(brushOrder[nextIndex]!);
  };

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
            selectRelativeBrush(-1);
            break;
          case ']':
            selectRelativeBrush(1);
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
