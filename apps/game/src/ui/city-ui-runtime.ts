import type { RciDefinitionRegistries } from '@web-three-city/rci-core';
import type { CommittedWorld } from '../application/committed-world.js';
import { createEconomyViewProjection } from '../economy-budget-hud.js';
import { createGameTimePresentation } from '../game-time-presentation.js';
import { createRciHudModel } from '../rci-hud.js';
import type { DialogHost } from './dialog/dialog-host.js';
import { mountPlayerShell, type PlayerShell } from './shell/player-shell.js';

export interface CityUiPorts {
  readonly setSpeed: Parameters<typeof mountPlayerShell>[1]['setSpeed'];
  readonly step: () => void;
  readonly rciRegistries: RciDefinitionRegistries;
}

export interface CityUiRuntime {
  readonly element: HTMLElement;
  readonly dialogHost: DialogHost;
  update(world: CommittedWorld): void;
  dispose(): void;
}

function demandSymbol(value: number): string {
  if (value > 0) return '↑';
  if (value < 0) return '↓';
  return '→';
}

export function mountCityUi(parent: HTMLElement, ports: CityUiPorts): CityUiRuntime {
  const openTextDialog = (key: string, title: string, text: string): void => {
    shell.dialogHost.open({ kind: 'system', key, title }, (body) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      body.append(paragraph);
    });
  };
  const shell: PlayerShell = mountPlayerShell(parent, {
    setSpeed: ports.setSpeed,
    step: ports.step,
    onInformationViews: () =>
      openTextDialog('information-views', 'Information Views', 'Canonical world overlays'),
    onCity: () => openTextDialog('city-overview', 'City', 'City Overview'),
    onGameMenu: () => openTextDialog('game-menu', 'Game Menu', 'World and camera controls'),
  });

  return Object.freeze({
    element: shell.element,
    dialogHost: shell.dialogHost,
    update(world: CommittedWorld): void {
      const economy = createEconomyViewProjection(world.economy);
      const rci = createRciHudModel(world.rci, ports.rciRegistries, world.simulation.absoluteTick);
      shell.update({
        population: String(rci.population),
        treasury: economy.treasury,
        net: economy.net,
        demand: `R${demandSymbol(rci.residentialDemand)} C${demandSymbol(rci.commercialDemand)} I${demandSymbol(rci.industrialDemand)}`,
        gameTime: createGameTimePresentation(world.simulation, world.buildings).calendarLabel,
      });
      shell.dialogHost.update();
    },
    dispose(): void {
      shell.dispose();
    },
  });
}
