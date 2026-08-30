import type { ScreenHandle } from "./screen-types";
import { createScreenFrame } from "./screen-types";

export function createStartupErrorScreen(message: string): ScreenHandle {
  const frame = createScreenFrame({
    eyebrow: "Startup error",
    title: "Web Three City could not start",
    description:
      "The application could not initialize its persistent city storage.",
  });
  const alert = document.createElement("div");
  alert.className = "city-screen__error";
  alert.setAttribute("role", "alert");
  alert.textContent = message;
  frame.body.append(alert);

  return Object.freeze({
    element: frame.element,
    dispose(): void {},
  });
}
