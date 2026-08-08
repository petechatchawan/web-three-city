import { mountDialogHost, type DialogHost } from '../dialog/dialog-host.js';
import type { UiAdapter } from '../foundation/lifecycle.js';
import { mountGameHud, type GameHudProjection } from './game-hud.js';
import { mountSimulationControls, type SimulationControlCallbacks } from './simulation-controls.js';
import { mountTopActions, type TopActionCallbacks } from './top-actions.js';

export type PlayerShellCallbacks = TopActionCallbacks & SimulationControlCallbacks;

export interface PlayerShell extends UiAdapter<GameHudProjection> {
  readonly dialogHost: DialogHost;
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
  const dialogHost = mountDialogHost(element);
  return Object.freeze({
    element,
    dialogHost,
    update(projection: GameHudProjection): void {
      hud.update(projection);
    },
    dispose(): void {
      dialogHost.dispose();
      element.remove();
    },
  });
}
