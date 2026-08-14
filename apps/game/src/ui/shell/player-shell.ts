import type { GameToolMode } from '../../game-tool-mode.js';
import { mountDialogHost, type DialogHost } from '../dialog/dialog-host.js';
import type { UiAdapter } from '../foundation/lifecycle.js';
import {
  mountBuildCategoryDock,
  type BuildCategoryDock,
} from './build-category-dock.js';
import { mountGameHud, type GameHudCallbacks, type GameHudProjection } from './game-hud.js';
import { mountPrimaryActions, type PrimaryActions } from './primary-actions.js';
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
  readonly primaryActions: PrimaryActions;
  readonly buildCategoryDock: BuildCategoryDock;
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
  const topActions = mountTopActions(element, callbacks);
  mountSimulationControls(topActions, callbacks, { compact: true });

  const toolContextSheet = mountToolContextSheet(element, {
    onUndo: callbacks.onUndo,
  });

  const subToolTray = mountSubToolTray(element, {
    onSelectTool: callbacks.selectTool,
    onBrush: callbacks.setTerraformBrush,
  });

  let buildOpen = false;

  const closeBuild = (): void => {
    buildOpen = false;
    primaryActions.setBuildOpen(false);
    buildCategoryDock.close();
    subToolTray.close();
    callbacks.selectTool('navigate');
  };

  const buildCategoryDock = mountBuildCategoryDock(element, {
    onSelectCategory: (category) => {
      buildOpen = true;
      primaryActions.setBuildOpen(true);
      buildCategoryDock.open();
      buildCategoryDock.setActiveCategory(category);
      subToolTray.open(category);
      callbacks.selectTool(defaultToolForCategory[category]);
    },
    onClose: closeBuild,
  });

  const primaryActions = mountPrimaryActions(element, {
    onNavigate: closeBuild,
    onToggleBuild: () => {
      if (buildOpen) {
        closeBuild();
        return;
      }
      buildOpen = true;
      primaryActions.setBuildOpen(true);
      buildCategoryDock.open();
      buildCategoryDock.setActiveCategory(null);
      subToolTray.close();
    },
  });

  const dialogHost = mountDialogHost(element);

  return Object.freeze({
    element,
    dialogHost,
    primaryActions,
    buildCategoryDock,
    subToolTray,
    toolContextSheet,
    update(projection: GameHudProjection): void {
      hud.update(projection);
    },
    dispose(): void {
      dialogHost.dispose();
      primaryActions.dispose();
      buildCategoryDock.dispose();
      subToolTray.dispose();
      toolContextSheet.dispose();
      element.remove();
    },
  });
}
