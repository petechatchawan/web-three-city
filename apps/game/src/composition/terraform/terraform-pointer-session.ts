import type { NormalizedPointerEvent } from "../../presentation/input/gesture-recognizer";

export interface TerraformPointerSession {
  onPointerEvent(event: NormalizedPointerEvent): void;
  dispose(): void;
}

export function createTerraformPointerSession(input: {
  readonly tapThresholdPixels: number;
  readonly onPreviewClientPoint: (x: number, y: number) => void;
  readonly onClearPreview: () => void;
}): TerraformPointerSession {
  let active:
    | {
        readonly id: number;
        readonly pointerType: "mouse" | "touch";
        readonly startX: number;
        readonly startY: number;
        canceled: boolean;
      }
    | undefined;
  let touchCount = 0;
  let disposed = false;

  const clearCandidate = (): void => {
    if (active !== undefined && !active.canceled) {
      active.canceled = true;
      input.onClearPreview();
    }
  };

  return Object.freeze({
    onPointerEvent(event: NormalizedPointerEvent): void {
      if (disposed) return;

      if (event.type === "down") {
        if (event.pointerType === "touch") {
          touchCount += 1;
          if (touchCount > 1) {
            clearCandidate();
            return;
          }
        }
        if (event.button !== 0 || active !== undefined) return;
        active = {
          id: event.id,
          pointerType: event.pointerType,
          startX: event.x,
          startY: event.y,
          canceled: false,
        };
        input.onPreviewClientPoint(event.x, event.y);
        return;
      }

      if (event.type === "move") {
        if (active === undefined) {
          if (event.pointerType === "mouse") {
            input.onPreviewClientPoint(event.x, event.y);
          }
          return;
        }
        if (event.id !== active.id || active.canceled) return;
        if (
          Math.hypot(event.x - active.startX, event.y - active.startY) >
          input.tapThresholdPixels
        ) {
          clearCandidate();
          return;
        }
        input.onPreviewClientPoint(event.x, event.y);
        return;
      }

      if (event.pointerType === "touch") {
        touchCount = Math.max(0, touchCount - 1);
      }
      if (active?.id === event.id) {
        if (event.type === "cancel") clearCandidate();
        active = undefined;
      }
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (active !== undefined && !active.canceled) input.onClearPreview();
      active = undefined;
      touchCount = 0;
    },
  });
}
