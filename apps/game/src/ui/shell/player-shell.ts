import { mountDialogHost, type DialogHost } from '../dialog/dialog-host.js';
import type { GameToolMode } from '../../game-tool-mode.js';
import type { UiAdapter } from '../foundation/lifecycle.js';
import { mountContextualToolSurface } from '../tools/contextual-tool-surface.js';
import { mountBuildDock, type BuildDock } from './build-dock.js';
import { mountGameHud, type GameHudProjection } from './game-hud.js';
import { mountSimulationControls, type SimulationControlCallbacks } from './simulation-controls.js';
import { mountTopActions, type TopActionCallbacks } from './top-actions.js';

function toolName(mode: GameToolMode): string {
  return mode
    .split('-')
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');
}

export type PlayerShellCallbacks = TopActionCallbacks &
  SimulationControlCallbacks & {
    readonly selectTool: Parameters<typeof mountBuildDock>[1];
    readonly setTerraformBrush: (size: 1 | 3 | 5) => void;
  };

export interface PlayerShell extends UiAdapter<GameHudProjection> {
  readonly dialogHost: DialogHost;
  readonly buildDock: BuildDock;
}

export function mountPlayerShell(
  parent: HTMLElement,
  callbacks: PlayerShellCallbacks,
): PlayerShell {
  const element = document.createElement('div');
  element.className = 'city-ui';
  parent.append(element);
  const hud = mountGameHud(element);
  mountTopActions(element, callbacks);
  mountSimulationControls(element, callbacks);
  const toolSurface = mountContextualToolSurface(element);
  toolSurface.update({
    mode: 'navigate',
    name: 'Navigate',
    state: 'Ready',
    message: 'Inspect or move around the city',
    undoAvailable: false,
  });
  const buildDock = mountBuildDock(
    element,
    (mode) => {
      callbacks.selectTool(mode);
      toolSurface.update({
        mode,
        name: toolName(mode),
        state: 'Ready',
        message: 'Point at the world to preview this tool',
        undoAvailable: false,
      });
    },
    callbacks.setTerraformBrush,
  );
  const dialogHost = mountDialogHost(element);
  return Object.freeze({
    element,
    dialogHost,
    buildDock,
    update(projection: GameHudProjection): void {
      hud.update(projection);
    },
    dispose(): void {
      dialogHost.dispose();
      buildDock.dispose();
      toolSurface.dispose();
      element.remove();
    },
  });
}
