import type { GameToolMode } from '../../game-tool-mode.js';
import { mountDialogHost, type DialogHost } from '../dialog/dialog-host.js';
import type { UiAdapter } from '../foundation/lifecycle.js';
import { mountBottomNav, type BottomNav } from './bottom-nav.js';
import { mountGameHud, type GameHudCallbacks, type GameHudProjection } from './game-hud.js';
import {
  mountSimulationControls,
  type SimulationControlCallbacks,
  type SimulationControls,
} from './simulation-controls.js';
import { mountSubToolTray, type SubToolTray, type TrayCategory } from './subtool-tray.js';
import { mountToolContextSheet, type ToolContextSheetAdapter } from './tool-context-sheet.js';
import type { TopActionCallbacks } from './top-actions.js';

const defaultToolForCategory: Readonly<Record<TrayCategory, GameToolMode>> = {
  terrain: 'raise',
  roads: 'road-build',
  zones: 'zone-residential',
  buildings: 'building-bulldoze',
};

const toolName: Readonly<Record<GameToolMode, string>> = {
  navigate: 'Navigate',
  raise: 'Raise',
  lower: 'Lower',
  flatten: 'Flatten',
  'road-build': 'Build Road',
  'road-bulldoze': 'Bulldoze Road',
  'zone-residential': 'Residential Zone',
  'zone-commercial': 'Commercial Zone',
  'zone-industrial': 'Industrial Zone',
  'zone-remove': 'Remove Zone',
  'building-bulldoze': 'Bulldoze Building',
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
  readonly simulationControls: SimulationControls;
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

  const toolContextSheet = mountToolContextSheet(element, {
    onUndo: callbacks.onUndo,
  });

  const selectTool = (mode: GameToolMode): void => {
    toolContextSheet.update({
      mode,
      name: toolName[mode],
      state: mode === 'navigate' ? '' : 'Tool ready',
      message: mode === 'navigate' ? '' : 'Point at the world to preview this tool',
    });
    callbacks.selectTool(mode);
  };

  const subToolTray = mountSubToolTray(element, {
    onSelectTool: selectTool,
    onBrush: callbacks.setTerraformBrush,
  });

  const bottomNav = mountBottomNav(element, (selection) => {
    if (selection === 'city') {
      callbacks.onCity();
      return;
    }

    if (selection === null) {
      subToolTray.close();
      selectTool('navigate');
      return;
    }

    subToolTray.open(selection);
    selectTool(defaultToolForCategory[selection]);
  });
  const simulationControls = mountSimulationControls(bottomNav.element, callbacks, {
    compact: true,
  });

  const dialogHost = mountDialogHost(element);

  return Object.freeze({
    element,
    dialogHost,
    bottomNav,
    simulationControls,
    subToolTray,
    toolContextSheet,
    update(projection: GameHudProjection): void {
      hud.update(projection);
    },
    dispose(): void {
      dialogHost.dispose();
      simulationControls.dispose();
      bottomNav.dispose();
      subToolTray.dispose();
      toolContextSheet.dispose();
      element.remove();
    },
  });
}
