import type { UiHandle } from "../primitives/types";
import type { UiSeverity } from "./status-indicator";

export function createToast(input: {
  readonly message: string;
  readonly severity?: UiSeverity;
}): UiHandle<HTMLElement> {
  const element = document.createElement("div");
  element.className = "ui-toast";
  element.dataset.severity = input.severity ?? "neutral";
  element.setAttribute("role", input.severity === "error" ? "alert" : "status");
  element.textContent = input.message;
  let disposed = false;
  return Object.freeze({
    element,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      element.remove();
    },
  });
}
