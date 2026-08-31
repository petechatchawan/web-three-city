import { createToast } from "../components/toast";
import type { UiSeverity } from "../components/status-indicator";
import type { UiHandle } from "../primitives/types";

export interface NotificationHostHandle extends UiHandle<HTMLElement> {
  notify(input: {
    readonly message: string;
    readonly severity?: UiSeverity;
    readonly durationMs?: number;
  }): void;
  clear(): void;
}

export function createNotificationHost(): NotificationHostHandle {
  const element = document.createElement("div");
  element.className = "game-notification-host";
  element.setAttribute("aria-live", "polite");
  element.setAttribute("aria-relevant", "additions text");
  const active = new Set<ReturnType<typeof createToast>>();
  const timers = new Map<ReturnType<typeof createToast>, number>();
  let disposed = false;

  const remove = (toast: ReturnType<typeof createToast>): void => {
    const timer = timers.get(toast);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.delete(toast);
    active.delete(toast);
    toast.dispose();
  };
  const clear = (): void => {
    for (const toast of [...active]) remove(toast);
  };

  return Object.freeze({
    element,
    notify(input: {
      readonly message: string;
      readonly severity?: UiSeverity;
      readonly durationMs?: number;
    }): void {
      if (disposed) return;
      const toast = createToast({
        message: input.message,
        ...(input.severity === undefined ? {} : { severity: input.severity }),
      });
      active.add(toast);
      element.append(toast.element);
      const durationMs = input.durationMs ?? 4000;
      if (durationMs > 0) {
        timers.set(
          toast,
          window.setTimeout(() => remove(toast), durationMs),
        );
      }
    },
    clear,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clear();
    },
  });
}
