export type GameUiCommand =
  | { readonly type: "toggle-tool"; readonly toolId: string }
  | { readonly type: "dismiss-top-layer" }
  | { readonly type: "open-game-menu" }
  | { readonly type: "save-city" };

interface KeyboardTargetLike {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

const CAMERA_KEY_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyQ",
  "KeyE",
]);

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (target === null || typeof target !== "object") return false;
  const value = target as {
    readonly tagName?: unknown;
    readonly isContentEditable?: unknown;
  };
  if (value.isContentEditable === true) return true;
  const tagName =
    typeof value.tagName === "string" ? value.tagName.toUpperCase() : "";
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

export interface GameCommandRouter {
  dispose(): void;
}

export function createGameCommandRouter(input: {
  readonly keyboardTarget?: KeyboardTargetLike;
  readonly toolShortcuts: readonly {
    readonly toolId: string;
    readonly key: string;
  }[];
  readonly onCommand: (command: GameUiCommand) => void;
}): GameCommandRouter {
  const keyboardTarget =
    input.keyboardTarget ??
    (typeof window === "undefined"
      ? undefined
      : (window as KeyboardTargetLike));
  const shortcuts = new Map(
    input.toolShortcuts.map((shortcut) => [
      shortcut.key.toLowerCase(),
      shortcut.toolId,
    ]),
  );
  let disposed = false;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (
      disposed ||
      event.repeat ||
      isEditableKeyboardTarget(event.target) ||
      CAMERA_KEY_CODES.has(event.code)
    ) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      input.onCommand({ type: "dismiss-top-layer" });
      return;
    }
    const toolId = shortcuts.get(event.key.toLowerCase());
    if (toolId === undefined) return;
    event.preventDefault();
    input.onCommand({ type: "toggle-tool", toolId });
  };

  keyboardTarget?.addEventListener("keydown", onKeyDown as EventListener);

  return Object.freeze({
    dispose(): void {
      if (disposed) return;
      disposed = true;
      keyboardTarget?.removeEventListener(
        "keydown",
        onKeyDown as EventListener,
      );
    },
  });
}
