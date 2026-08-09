import type { RciDefinitionRegistries } from '@web-three-city/rci-core';
import type { CommittedWorld } from '../application/committed-world.js';
import { createEconomyViewProjection } from '../economy-budget-hud.js';
import { createGameTimePresentation } from '../game-time-presentation.js';
import { createRciHudModel } from '../rci-hud.js';
import type { DialogHost } from './dialog/dialog-host.js';
import { openInspectDialog } from './inspect/inspect-dialog.js';
import { pickInspectTarget } from './inspect/inspect-target.js';
import { createInformationViewRegistry } from './information-views/information-view-registry.js';
import { mountPlayerShell, type PlayerShell } from './shell/player-shell.js';
import type { ContextualToolProjection } from './shell/tool-context-sheet.js';
import type { UiAdapter } from './foundation/lifecycle.js';
import { createCitySystemDialogs } from './systems/city-system-dialogs.js';

export interface CityUiPorts {
  readonly setSpeed: Parameters<typeof mountPlayerShell>[1]['setSpeed'];
  readonly step: () => void;
  readonly selectTool: Parameters<typeof mountPlayerShell>[1]['selectTool'];
  readonly setTerraformBrush: Parameters<typeof mountPlayerShell>[1]['setTerraformBrush'];
  readonly submitTaxPolicy: Parameters<typeof createCitySystemDialogs>[1]['submitTaxPolicy'];
  readonly setInformationView: (key: 'grid' | 'zoning' | null) => void;
  readonly saveWorld: () => void;
  readonly loadWorld: () => void;
  readonly rotateLeft: () => void;
  readonly rotateRight: () => void;
  readonly resetCamera: () => void;
  readonly toggleGrid: () => void;
  readonly setQuality: (quality: 'low' | 'medium' | 'high') => void;
  readonly rciRegistries: RciDefinitionRegistries;
}

export interface CityUiRuntime {
  readonly element: HTMLElement;
  readonly dialogHost: DialogHost;
  readonly toolContextSheet: UiAdapter<ContextualToolProjection>;
  update(world: CommittedWorld): void;
  inspectCell(cell: Readonly<{ x: number; z: number }>): void;
  dispose(): void;
}

function demandSymbol(value: number): string {
  if (value > 0) return '↑';
  if (value < 0) return '↓';
  return '→';
}

export function mountCityUi(parent: HTMLElement, ports: CityUiPorts): CityUiRuntime {
  let latestWorld: CommittedWorld | null = null;
  const informationViews = createInformationViewRegistry([
    {
      key: 'grid',
      title: 'Canonical Grid',
      legend: 'Canonical build-cell boundaries',
      activate: () => ports.setInformationView('grid'),
      deactivate: () => ports.setInformationView(null),
    },
    {
      key: 'zoning',
      title: 'Zoning',
      legend: 'Residential, Commercial, and Industrial zones',
      activate: () => ports.setInformationView('zoning'),
      deactivate: () => ports.setInformationView(null),
    },
  ]);
  const renderInformationViews = (body: HTMLElement): void => {
    for (const entry of informationViews.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = entry.title;
      button.dataset.informationView = entry.key;
      button.addEventListener('click', () => {
        informationViews.replace(entry.key);
        shell.dialogHost.update();
      });
      body.append(button);
    }
    const active = informationViews.projection();
    if (active !== null) {
      const legend = document.createElement('p');
      legend.dataset.testid = 'information-view-legend';
      legend.textContent = `${active.title}: ${active.legend}`;
      const deactivate = document.createElement('button');
      deactivate.type = 'button';
      deactivate.textContent = 'Deactivate view';
      deactivate.addEventListener('click', () => {
        informationViews.deactivate();
        shell.dialogHost.update();
      });
      body.append(legend, deactivate);
    }
  };
  const shell: PlayerShell = mountPlayerShell(parent, {
    setSpeed: ports.setSpeed,
    step: ports.step,
    selectTool: ports.selectTool,
    setTerraformBrush: ports.setTerraformBrush,
    onInformationViews: () =>
      shell.dialogHost.open(
        { kind: 'system', key: 'information-views', title: 'Information Views' },
        renderInformationViews,
      ),
    onCity: () => systemDialogs.openCity(),
    onSelectMetric: (metric) => {
      const route = shell.dialogHost.activeRoute;
      if (metric === 'population' || metric === 'treasury' || metric === 'net') {
        if (route?.key === 'city-overview') shell.dialogHost.close();
        else systemDialogs.openCity();
      } else if (metric === 'demand') {
        if (route?.key === 'population-rci') shell.dialogHost.close();
        else systemDialogs.openPopulationRci();
      } else {
        if (route?.key === 'simulation-time') shell.dialogHost.close();
        else systemDialogs.openSimulationTime();
      }
    },
    onGameMenu: () =>
      shell.dialogHost.open({ kind: 'system', key: 'game-menu', title: 'Game Menu' }, (body) => {
        const actions = [
          ['Save world', ports.saveWorld],
          ['Load world', ports.loadWorld],
          ['Rotate left', ports.rotateLeft],
          ['Rotate right', ports.rotateRight],
          ['Reset camera', ports.resetCamera],
          ['Grid', ports.toggleGrid],
        ] as const;
        for (const [label, action] of actions) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = label;
          button.addEventListener('click', () => {
            action();
            shell.dialogHost.close();
          });
          body.append(button);
        }
        const qualityLabel = document.createElement('label');
        qualityLabel.textContent = 'Quality';
        const quality = document.createElement('select');
        quality.setAttribute('aria-label', 'Quality');
        for (const value of ['low', 'medium', 'high'] as const) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value[0]!.toUpperCase() + value.slice(1);
          quality.append(option);
        }
        quality.value = 'medium';
        quality.addEventListener('change', () =>
          ports.setQuality(quality.value as 'low' | 'medium' | 'high'),
        );
        qualityLabel.append(quality);
        body.append(qualityLabel);
      }),
  });
  const systemDialogs = createCitySystemDialogs(shell.dialogHost, {
    getWorld: () => {
      if (latestWorld === null) throw new Error('city-ui:world-unavailable');
      return latestWorld;
    },
    rciRegistries: ports.rciRegistries,
    submitTaxPolicy: ports.submitTaxPolicy,
  });

  return Object.freeze({
    element: shell.element,
    dialogHost: shell.dialogHost,
    toolContextSheet: shell.toolContextSheet,
    update(world: CommittedWorld): void {
      latestWorld = world;
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
    inspectCell(cell: Readonly<{ x: number; z: number }>): void {
      if (latestWorld === null) return;
      openInspectDialog(
        shell.dialogHost,
        () => latestWorld!,
        ports.rciRegistries,
        pickInspectTarget(latestWorld, cell),
      );
    },
    dispose(): void {
      informationViews.deactivate();
      shell.dispose();
    },
  });
}
