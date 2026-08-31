import { createIconButton } from "../primitives/icon-button";
import type { StatefulUiHandle } from "../primitives/types";

export interface InspectorSurfaceViewState {
  readonly open: boolean;
  readonly label: string;
  readonly content: HTMLElement;
}

export type InspectorSurfaceHandle =
  StatefulUiHandle<InspectorSurfaceViewState>;

export function createInspectorSurface(input: {
  readonly onDismiss: () => void;
}): InspectorSurfaceHandle {
  const element = document.createElement("aside");
  element.className = "game-inspector-surface";
  element.hidden = true;
  const header = document.createElement("header");
  header.className = "game-inspector-surface__header";
  const title = document.createElement("h2");
  title.className = "game-inspector-surface__title";
  const close = createIconButton({
    icon: "close",
    ariaLabel: "Close inspector",
    onPress: input.onDismiss,
  });
  const body = document.createElement("div");
  body.className = "game-inspector-surface__body";
  header.append(title, close.element);
  element.append(header, body);
  let currentContent: HTMLElement | undefined;
  let disposed = false;

  return Object.freeze({
    element,
    render(state: InspectorSurfaceViewState): void {
      if (disposed) return;
      element.hidden = !state.open;
      element.setAttribute("aria-label", state.label);
      title.textContent = state.label;
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
