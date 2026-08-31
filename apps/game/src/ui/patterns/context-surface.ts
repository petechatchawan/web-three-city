import { createIconButton } from "../primitives/icon-button";
import type { StatefulUiHandle } from "../primitives/types";

export type ContextSurfaceMode = "compact" | "expanded" | "fullscreen";

export interface ContextSurfaceViewState {
  readonly open: boolean;
  readonly label: string;
  readonly mode: ContextSurfaceMode;
  readonly content: HTMLElement;
}

export type ContextSurfaceHandle = StatefulUiHandle<ContextSurfaceViewState>;

export function createContextSurface(input: {
  readonly onDismiss: () => void;
}): ContextSurfaceHandle {
  const element = document.createElement("section");
  element.className = "game-context-surface";
  element.dataset.testid = "game-context-surface";
  element.hidden = true;

  const header = document.createElement("header");
  header.className = "game-context-surface__header";
  const title = document.createElement("h2");
  title.className = "game-context-surface__title";
  const close = createIconButton({
    icon: "close",
    ariaLabel: "Close tools",
    onPress: input.onDismiss,
  });
  close.element.classList.add("game-context-surface__close");
  header.append(title, close.element);

  const body = document.createElement("div");
  body.className = "game-context-surface__body";
  element.append(header, body);
  let currentContent: HTMLElement | undefined;
  let disposed = false;

  return Object.freeze({
    element,
    render(state: ContextSurfaceViewState): void {
      if (disposed) return;
      element.hidden = !state.open;
      element.dataset.mode = state.mode;
      element.setAttribute("aria-label", state.label);
      title.textContent = state.label;
      close.element.setAttribute("aria-label", `Close ${state.label}`);
      if (currentContent !== state.content) {
        currentContent = state.content;
        body.replaceChildren(state.content);
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      close.dispose();
      currentContent = undefined;
      body.replaceChildren();
    },
  });
}
