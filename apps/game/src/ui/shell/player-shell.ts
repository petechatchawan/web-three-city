import type { GameToolMode } from '../../game-tool-mode.js';
import { toolLabel } from '../../game-tool-context-bridge.js';
import { mountDialogHost, type DialogHost } from '../dialog/dialog-host.js';
import type { UiAdapter } from '../foundation/lifecycle.js';
import { mountBottomNav, type BottomNav, type NavCategory } from './bottom-nav.js';
import { mountGameHud, type GameHudCallbacks, type GameHudProjection } from './game-hud.js';
import { mountSimulationControls, type SimulationControlCallbacks } from './simulation-controls.js';
import { mountSubToolTray, type SubToolTray, type TrayCategory } from './subtool-tray.js';
import { mountToolContextSheet, type ToolContextSheetAdapter } from './tool-context-sheet.js';
import { mountTopActions, type TopActionCallbacks } from './top-actions.js';

const defaultToolForCategory: Readonly<Record<TrayCategory, GameToolMode>> = {
  terrain: 'raise',
  roads: 'road-build',
  zones: 'zone-residential',
  buildings: 'building-bulldoze',
};

export type PlayerShellCallbacks = TopActionCallbacks &
  SimulationControlCallbacks & {
    readonly selectTool: (mode: GameToolMode) => void;
    readonly setTerraformBrush: (size: 1 | 3 | 5) => void;
    readonly onSelectMetric: GameHudCallbacks['onSelectMetric'];
    readonly onUndo: () => void;
  };

export interface PlayerShell extends UiAdapter<GameHudProjection> {
  readonly dialogHost: DialogHost;
  readonly bottomNav: BottomNav;
  readonly subToolTray: SubToolTray;
  readonly toolContextSheet: ToolContextSheetAdapter;
}

export function mountPlayerShell(
  parent: HTMLElement,
  callbacks: PlayerShellCallbacks,
): PlayerShell {
  const element = document.createElement('div');
  element.className = 'city-ui';
  parent.append(element);

  const hud = mountGameHud(element, { onSelectMetric: callbacks.onSelectMetric });
  mountTopActions(element, callbacks);

  const toolSurface = mountToolContextSheet(element, { onUndo: callbacks.onUndo });
  toolSurface.update({
    mode: 'navigate',
    name: 'Navigate',
    state: 'Ready',
    message: 'Inspect or move around the city',
  });

  const subToolTray = mountSubToolTray(element, {
    onSelectTool: (mode) => {
      callbacks.selectTool(mode);
      toolSurface.update({
        mode,
        name: toolLabel(mode),
        state: 'Ready',
        message: 'Point at the world to preview this tool',
      });
    },
    onBrush: callbacks.setTerraformBrush,
  });

  const bottomNav = mountBottomNav(element, (category: NavCategory) => {
    if (category === 'navigate') {
      subToolTray.close();
      callbacks.selectTool('navigate');
      toolSurface.update({
        mode: 'navigate',
        name: 'Navigate',
        state: 'Ready',
        message: 'Inspect or move around the city',
      });
      return;
    }
    subToolTray.open(category);
    const mode = defaultToolForCategory[category];
    callbacks.selectTool(mode);
    toolSurface.update({
      mode,
      name: toolLabel(mode),
      state: 'Ready',
      message: 'Point at the world to preview this tool',
    });
  });

  mountSimulationControls(element, callbacks, { compact: true });
  const dialogHost = mountDialogHost(element);

  return Object.freeze({
    element,
    dialogHost,
    bottomNav,
    subToolTray,
    toolContextSheet: toolSurface,
    update(projection: GameHudProjection): void {
      hud.update(projection);
    },
    dispose(): void {
      dialogHost.dispose();
      bottomNav.dispose();
      subToolTray.dispose();
      toolSurface.dispose();
      element.remove();
    },
  });
}
