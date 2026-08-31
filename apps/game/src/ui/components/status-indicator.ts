import type { StatefulUiHandle } from "../primitives/types";

export type UiSeverity = "neutral" | "success" | "warning" | "error" | "info";

export interface StatusIndicatorState {
  readonly message: string;
  readonly severity: UiSeverity;
}

export function createStatusIndicator(): StatefulUiHandle<StatusIndicatorState> {
  const element = document.createElement("p");
  element.className = "ui-status-indicator";
  element.setAttribute("role", "status");
  let disposed = false;
  return Object.freeze({
    element,
    render(state: StatusIndicatorState): void {
      if (disposed) return;
      element.textContent = state.message;
      element.dataset.severity = state.severity;
    },
    dispose(): void {
      disposed = true;
    },
  });
}
