import { createGameShellView } from "./game/create-game-shell-view";
import type { ScreenHandle } from "./screen-types";

export interface GameScreenHandle extends ScreenHandle {
  readonly viewport: HTMLElement;
  readonly hudHost: HTMLElement;
  readonly toolDockHost: HTMLElement;
  readonly contextHost: HTMLElement;
  readonly inspectorHost: HTMLElement;
  readonly dialogHost: HTMLElement;
  readonly notificationHost: HTMLElement;
  readonly debugHost: HTMLElement;
  setBusy(busy: boolean): void;
  setActiveTool(toolId?: string): void;
}

export function createGameScreen(): GameScreenHandle {
  const shell = createGameShellView();
  let busy = false;
  let activeToolId: string | undefined;
  let disposed = false;

  const renderShell = (): void => {
    shell.render({
      busy,
      ...(activeToolId === undefined ? {} : { activeToolId }),
    });
  };
  renderShell();

  return Object.freeze({
    element: shell.element,
    viewport: shell.viewport,
    hudHost: shell.hudHost,
    toolDockHost: shell.toolDockHost,
    contextHost: shell.contextHost,
    inspectorHost: shell.inspectorHost,
    dialogHost: shell.dialogHost,
    notificationHost: shell.notificationHost,
    debugHost: shell.debugHost,
    setBusy(next: boolean): void {
      busy = next;
      renderShell();
    },
    setActiveTool(toolId?: string): void {
      activeToolId = toolId;
      renderShell();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      shell.dispose();
    },
  });
}
