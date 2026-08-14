import type { GameToolMode } from '../../game-tool-mode.js';
import { mountDialogHost, type DialogHost } from '../dialog/dialog-host.js';
import type { UiAdapter } from '../foundation/lifecycle.js';
import { uiText, type UiCopyKey, type UiLocale } from '../presentation-locale.js';
import { mountBottomNav, type BottomNav } from './bottom-nav.js';
import { mountGameHud, type GameHudCallbacks, type GameHudProjection } from './game-hud.js';
import {
  mountSimulationControls,
  type SimulationControlCallbacks,
  type SimulationControls,
} from './simulation-controls.js';
import { mountSubToolTray, type SubToolTray } from './subtool-tray.js';
import { mountToolContextSheet, type ToolContextSheetAdapter } from './tool-context-sheet.js';
import type { TopActionCallbacks } from './top-actions.js';

const toolLabelKey: Readonly<Record<GameToolMode, UiCopyKey | null>> = {
  navigate: null,
  raise: 'raise',
  lower: 'lower',
  flatten: 'flatten',
  'road-build': 'buildRoad',
  'road-bulldoze': 'bulldozeRoad',
  'zone-residential': 'residential',
  'zone-commercial': 'commercial',
  'zone-industrial': 'industrial',
  'zone-remove': 'removeZone',
  'building-bulldoze': 'bulldozeBuilding',
};

function toolName(locale: UiLocale, mode: GameToolMode): string {
  const key = toolLabelKey[mode];
  return key === null ? (locale === 'th' ? 'สำรวจ' : 'Navigate') : uiText(locale, key);
}

export type PlayerShellCallbacks = TopActionCallbacks &
  SimulationControlCallbacks & {
    readonly selectTool: (mode: GameToolMode) => void;
    readonly setTerraformBrush: (size: 1 | 3 | 5) => void;
    readonly onSelectMetric: GameHudCallbacks['onSelectMetric'];
    readonly onUndo: () => void;
    readonly onBuildOpen?: () => void;
  };

export interface PlayerShell extends UiAdapter<GameHudProjection> {
  readonly dialogHost: DialogHost;
  readonly bottomNav: BottomNav;
  readonly simulationControls: SimulationControls;
  readonly subToolTray: SubToolTray;
  readonly toolContextSheet: ToolContextSheetAdapter;
  setLocale(locale: UiLocale): void;
}

export function mountPlayerShell(
  parent: HTMLElement,
  callbacks: PlayerShellCallbacks,
  initialLocale: UiLocale = 'en',
): PlayerShell {
  const element = document.createElement('div');
  element.className = 'city-ui';
  parent.append(element);

  let locale = initialLocale;
  let activeMode: GameToolMode = 'navigate';

  const hud = mountGameHud(element, { onSelectMetric: callbacks.onSelectMetric }, locale);

  const toolContextSheet = mountToolContextSheet(element, {
    onUndo: callbacks.onUndo,
  });

  const renderToolContext = (): void => {
    toolContextSheet.update({
      mode: activeMode,
      name: toolName(locale, activeMode),
      state: activeMode === 'navigate' ? '' : uiText(locale, 'toolReady'),
      message: '',
    });
  };

  const selectTool = (mode: GameToolMode): void => {
    activeMode = mode;
    renderToolContext();
    callbacks.selectTool(mode);
  };

  const subToolTray = mountSubToolTray(
    element,
    {
      onSelectTool: selectTool,
      onBrush: callbacks.setTerraformBrush,
      onClose: () => bottomNav.setBuildOpen(false),
    },
    locale,
  );

  const bottomNav = mountBottomNav(
    element,
    (selection) => {
      if (selection === 'city') {
        subToolTray.close();
        callbacks.onCity();
        return;
      }

      if (subToolTray.element.hidden) {
        callbacks.onBuildOpen?.();
        subToolTray.open();
      } else {
        subToolTray.close();
      }
    },
    locale,
  );

  const simulationControls = mountSimulationControls(bottomNav.element, callbacks, {
    compact: true,
  });

  const dialogHost = mountDialogHost(element);
  renderToolContext();

  return Object.freeze({
    element,
    dialogHost,
    bottomNav,
    simulationControls,
    subToolTray,
    toolContextSheet,
    setLocale(nextLocale: UiLocale): void {
      locale = nextLocale;
      bottomNav.setLocale(locale);
      subToolTray.setLocale(locale);
      hud.setLocale(locale);
      renderToolContext();
    },
    update(projection: GameHudProjection): void {
      hud.update(projection);
    },
    dispose(): void {
      dialogHost.dispose();
      simulationControls.dispose();
      bottomNav.dispose();
      subToolTray.dispose();
      toolContextSheet.dispose();
      hud.dispose();
      element.remove();
    },
  });
}
