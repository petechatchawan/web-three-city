import type { StatefulUiHandle } from "../../primitives/types";
import type { GameShellViewState } from "./game-shell-view-state";

export interface GameShellView extends StatefulUiHandle<GameShellViewState> {
  readonly viewport: HTMLElement;
  readonly hudHost: HTMLElement;
  readonly toolDockHost: HTMLElement;
  readonly contextHost: HTMLElement;
  readonly inspectorHost: HTMLElement;
  readonly dialogHost: HTMLElement;
  readonly notificationHost: HTMLElement;
  readonly debugHost: HTMLElement;
}

function createHost(
  testId: string,
  className: string,
  layer: string,
): HTMLElement {
  const host = document.createElement("div");
  host.className = `game-shell__host ${className}`;
  host.dataset.testid = testId;
  host.dataset.layer = layer;
  return host;
}

export function createGameShellView(): GameShellView {
  const element = document.createElement("section");
  element.className = "game-screen game-shell";
  element.dataset.testid = "game-screen";

  const viewport = document.createElement("div");
  viewport.className = "game-screen__viewport game-shell__viewport";
  viewport.dataset.testid = "game-viewport";

  const hudHost = createHost("game-hud-host", "game-shell__hud-host", "hud");
  const toolDockHost = createHost(
    "game-tool-dock-host",
    "game-shell__tool-dock-host",
    "tool",
  );
  const contextHost = createHost(
    "game-context-host",
    "game-shell__context-host",
    "tool",
  );
  const inspectorHost = createHost(
    "game-inspector-host",
    "game-shell__inspector-host",
    "inspector",
  );
  const dialogHost = createHost(
    "game-dialog-host",
    "game-shell__dialog-host",
    "dialog",
  );
  const notificationHost = createHost(
    "game-notification-host",
    "game-shell__notification-host",
    "toast",
  );
  const debugHost = createHost(
    "game-debug-host",
    "game-shell__debug-host",
    "debug",
  );

  element.append(
    viewport,
    hudHost,
    toolDockHost,
    contextHost,
    inspectorHost,
    dialogHost,
    notificationHost,
    debugHost,
  );
  let disposed = false;

  return Object.freeze({
    element,
    viewport,
    hudHost,
    toolDockHost,
    contextHost,
    inspectorHost,
    dialogHost,
    notificationHost,
    debugHost,
    render(state: GameShellViewState): void {
      if (disposed) return;
      if (state.activeToolId === undefined) delete element.dataset.activeTool;
      else element.dataset.activeTool = state.activeToolId;
      element.dataset.busy = String(state.busy ?? false);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      element.replaceChildren();
    },
  });
}
