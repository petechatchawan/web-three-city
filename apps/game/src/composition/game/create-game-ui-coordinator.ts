import { createIconButton } from "../../ui/primitives/icon-button";
import type { UiHandle } from "../../ui/primitives/types";
import { createDialogHost } from "../../ui/patterns/dialog-host";
import { createGameHud } from "../../ui/patterns/game-hud";
import { createGameMenu } from "../../ui/patterns/game-menu";
import { createInspectorSurface } from "../../ui/patterns/inspector-surface";
import { createNotificationHost } from "../../ui/patterns/notification-host";

export interface GameUiCoordinator extends UiHandle<HTMLElement> {
  setBusy(busy: boolean): void;
  notifySaveSuccess(): void;
  notifySaveFailure(message: string): void;
  openGameMenu(): void;
  closeGameMenu(): void;
  openDebug(): void;
  closeDebug(): void;
  setInspector(input?: {
    readonly label: string;
    readonly content: HTMLElement;
  }): void;
  dismissTopLayer(): void;
}

export function createGameUiCoordinator(input: {
  readonly cityName: string;
  readonly hudHost: HTMLElement;
  readonly inspectorHost: HTMLElement;
  readonly dialogHost: HTMLElement;
  readonly notificationHost: HTMLElement;
  readonly debugHost: HTMLElement;
  readonly worldUnderlay: HTMLElement;
  readonly debugContent: HTMLElement;
  readonly dismissToolNavigation: () => boolean;
  readonly onSave: () => void;
  readonly onExit: () => void;
}): GameUiCoordinator {
  const element = document.createElement("div");
  const hud = createGameHud();
  const menuButton = createIconButton({
    icon: "menu",
    ariaLabel: "Open game menu",
    onPress: () => openGameMenu(),
  });
  let busy = false;
  const renderHud = (): void => {
    hud.render({
      cityLabel: input.cityName,
      metrics: [],
      actions: [menuButton.element],
    });
    menuButton.element.disabled = busy;
  };

  const notifications = createNotificationHost();
  const inspectorEmpty = document.createElement("div");
  const inspector = createInspectorSurface({ onDismiss: () => setInspector() });
  let inspectorOpen = false;
  inspector.render({
    open: false,
    label: "Inspector",
    content: inspectorEmpty,
  });

  const debug = document.createElement("section");
  debug.className = "game-debug-surface";
  debug.setAttribute("role", "region");
  debug.setAttribute("aria-label", "Terrain Debug");
  debug.hidden = true;
  const debugHeader = document.createElement("header");
  debugHeader.className = "game-debug-surface__header";
  const debugTitle = document.createElement("h2");
  debugTitle.textContent = "Terrain Debug";
  const closeDebugButton = createIconButton({
    icon: "close",
    ariaLabel: "Close debug",
    onPress: () => closeDebug(),
  });
  debugHeader.append(debugTitle, closeDebugButton.element);
  debug.append(debugHeader, input.debugContent);

  const dialogHost = createDialogHost({ worldUnderlay: input.worldUnderlay });
  const menu = createGameMenu({
    title: "Game menu",
    actions: [
      { id: "resume", label: "Resume" },
      { id: "save", label: "Save City" },
      { id: "exit", label: "Exit to Main Menu", variant: "danger" },
    ],
    onAction: (actionId) => {
      if (actionId === "resume") closeGameMenu();
      else if (actionId === "save") input.onSave();
      else if (actionId === "exit") input.onExit();
    },
  });

  let disposed = false;

  function openGameMenu(): void {
    if (disposed || menu.isOpen()) return;
    dialogHost.open(menu);
  }

  function closeGameMenu(): void {
    if (disposed || !menu.isOpen()) return;
    menu.close();
  }

  function openDebug(): void {
    if (disposed) return;
    debug.hidden = false;
  }

  function closeDebug(): void {
    if (disposed) return;
    debug.hidden = true;
  }

  function setInspector(next?: {
    readonly label: string;
    readonly content: HTMLElement;
  }): void {
    if (disposed) return;
    inspectorOpen = next !== undefined;
    inspector.render(
      next === undefined
        ? { open: false, label: "Inspector", content: inspectorEmpty }
        : { open: true, label: next.label, content: next.content },
    );
  }

  renderHud();
  input.hudHost.append(hud.element);
  input.inspectorHost.append(inspector.element);
  input.dialogHost.append(dialogHost.element);
  input.notificationHost.append(notifications.element);
  input.debugHost.append(debug);

  return Object.freeze({
    element,
    setBusy(next: boolean): void {
      if (disposed) return;
      busy = next;
      renderHud();
    },
    notifySaveSuccess(): void {
      notifications.notify({ message: "City saved", severity: "success" });
    },
    notifySaveFailure(message: string): void {
      notifications.notify({ message, severity: "error" });
    },
    openGameMenu,
    closeGameMenu,
    openDebug,
    closeDebug,
    setInspector,
    dismissTopLayer(): void {
      if (disposed) return;
      if (menu.isOpen()) {
        closeGameMenu();
        return;
      }
      if (!debug.hidden) {
        closeDebug();
        return;
      }
      if (inspectorOpen) {
        setInspector();
        return;
      }
      if (input.dismissToolNavigation()) return;
      openGameMenu();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      closeDebugButton.dispose();
      menuButton.dispose();
      menu.dispose();
      dialogHost.dispose();
      inspector.dispose();
      notifications.dispose();
      hud.dispose();
      debug.remove();
      element.remove();
    },
  });
}
