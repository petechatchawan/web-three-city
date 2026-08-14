import type { RciDefinitionRegistries } from '@web-three-city/rci-core';
import type { CommittedWorld } from '../application/committed-world.js';
import { createEconomyViewProjection } from '../economy-budget-hud.js';
import type { GameToolMode } from '../game-tool-mode.js';
import { createGameTimePresentation } from '../game-time-presentation.js';
import { createRciHudModel } from '../rci-hud.js';
import { createCityIcon, type CityIconName } from './components/icon.js';
import type { DialogHost } from './dialog/dialog-host.js';
import { createInspectProjection } from './inspect/inspect-projections.js';
import { mountInspectSurface, type InspectSurface } from './inspect/inspect-surface.js';
import { pickInspectTarget } from './inspect/inspect-target.js';
import { createInformationViewRegistry } from './information-views/information-view-registry.js';
import {
  persistUiLocale,
  readStoredUiLocale,
  uiText,
  type UiLocale,
} from './presentation-locale.js';
import { mountPlayerShell } from './shell/player-shell.js';
import type { ToolContextSheetAdapter } from './shell/tool-context-sheet.js';
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
  readonly undo: () => void;
  readonly rciRegistries: RciDefinitionRegistries;
}

export interface CityUiRuntime {
  readonly element: HTMLElement;
  readonly dialogHost: DialogHost;
  readonly toolContextSheet: ToolContextSheetAdapter;
  selectTool(mode: GameToolMode): void;
  setSimulationSpeed(speed: Parameters<CityUiPorts['setSpeed']>[0]): void;
  update(world: CommittedWorld): void;
  inspectCell(cell: Readonly<{ x: number; z: number }>): void;
  dispose(): void;
}

function demandSymbol(value: number): string {
  if (value > 0) return '↑';
  if (value < 0) return '↓';
  return '→';
}

function menuSection(body: HTMLElement, key: string, title: string): HTMLElement {
  const section = document.createElement('section');
  section.className = 'city-menu-section';
  section.dataset.menuSection = key;
  const heading = document.createElement('h3');
  heading.className = 'city-section-title';
  heading.textContent = title;
  const grid = document.createElement('div');
  grid.className = 'city-action-grid';
  section.append(heading, grid);
  body.append(section);
  return grid;
}

function menuAction(
  parent: HTMLElement,
  label: string,
  icon: CityIconName,
  action: () => void,
): void {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'city-menu-tile';
  button.setAttribute('aria-label', label);
  button.append(createCityIcon(icon));
  const copy = document.createElement('span');
  copy.textContent = label;
  button.append(copy);
  button.addEventListener('click', action);
  parent.append(button);
}

export function mountCityUi(parent: HTMLElement, ports: CityUiPorts): CityUiRuntime {
  let latestWorld: CommittedWorld | null = null;
  let locale: UiLocale = readStoredUiLocale();
  let inspectSurface: InspectSurface | null = null;
  let activeToolMode: GameToolMode = 'navigate';
  let applyLocale: ((nextLocale: UiLocale) => void) | null = null;

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
    const grid = document.createElement('div');
    grid.className = 'city-action-grid';
    for (const entry of informationViews.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'city-sheet-action';
      button.textContent = entry.title;
      button.dataset.informationView = entry.key;
      button.addEventListener('click', () => {
        informationViews.replace(entry.key);
        shell.dialogHost.refresh();
      });
      grid.append(button);
    }
    body.append(grid);
    const active = informationViews.projection();
    if (active !== null) {
      const card = document.createElement('section');
      card.className = 'city-card city-information-card';
      const legend = document.createElement('p');
      legend.dataset.testid = 'information-view-legend';
      legend.textContent = `${active.title}: ${active.legend}`;
      const deactivate = document.createElement('button');
      deactivate.type = 'button';
      deactivate.className = 'city-ghost-button';
      deactivate.textContent = 'Deactivate view';
      deactivate.addEventListener('click', () => {
        informationViews.deactivate();
        shell.dialogHost.refresh();
      });
      card.append(legend, deactivate);
      body.append(card);
    }
  };

  const openInformationViews = (): void => {
    shell.dialogHost.open(
      { kind: 'system', key: 'information-views', title: 'Information Views' },
      renderInformationViews,
    );
  };

  const openGameMenu = (): void => {
    shell.dialogHost.open({ kind: 'system', key: 'game-menu', title: 'Game Menu' }, (body) => {
      const world = menuSection(body, 'world', locale === 'th' ? 'โลก' : 'World');
      menuAction(world, locale === 'th' ? 'บันทึกเมือง' : 'Save world', 'save', () => {
        ports.saveWorld();
        shell.dialogHost.close();
      });
      menuAction(world, locale === 'th' ? 'โหลดเมือง' : 'Load world', 'load', () => {
        ports.loadWorld();
        shell.dialogHost.close();
      });

      const camera = menuSection(body, 'camera', locale === 'th' ? 'กล้อง' : 'Camera');
      const cameraActions = [
        [locale === 'th' ? 'หมุนซ้าย' : 'Rotate left', 'rotate-left', ports.rotateLeft],
        [locale === 'th' ? 'หมุนขวา' : 'Rotate right', 'rotate-right', ports.rotateRight],
        [locale === 'th' ? 'รีเซ็ตกล้อง' : 'Reset camera', 'reset-camera', ports.resetCamera],
        [locale === 'th' ? 'กริด' : 'Grid', 'grid', ports.toggleGrid],
      ] as const;
      for (const [label, icon, action] of cameraActions) {
        menuAction(camera, label, icon, () => {
          action();
          shell.dialogHost.close();
        });
      }

      const presentation = menuSection(
        body,
        'presentation',
        locale === 'th' ? 'การแสดงผล' : 'Presentation',
      );
      const qualityCard = document.createElement('label');
      qualityCard.className = 'city-quality-card';
      qualityCard.append(createCityIcon('quality'));
      const text = document.createElement('span');
      text.textContent = locale === 'th' ? 'คุณภาพ' : 'Quality';
      const quality = document.createElement('select');
      quality.setAttribute('aria-label', text.textContent);
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
      qualityCard.append(text, quality);
      presentation.append(qualityCard);
    });
  };

  const appendLocaleSelector = (): void => {
    if (shell.dialogHost.activeRoute?.key !== 'city-overview') return;
    const body = shell.dialogHost.element.querySelector<HTMLElement>('.city-sheet-body');
    if (body === null || body.querySelector('.city-locale-selector') !== null) return;

    const section = document.createElement('section');
    section.className = 'city-card city-locale-card';
    const heading = document.createElement('h3');
    heading.className = 'city-section-title';
    heading.textContent = uiText(locale, 'language');
    const selector = document.createElement('div');
    selector.className = 'city-locale-selector';

    for (const nextLocale of ['en', 'th'] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.testid = `locale-${nextLocale}`;
      button.setAttribute('aria-pressed', String(locale === nextLocale));
      button.textContent = uiText(locale, nextLocale === 'en' ? 'english' : 'thai');
      button.addEventListener('click', () => applyLocale?.(nextLocale));
      selector.append(button);
    }
    section.append(heading, selector);
    body.append(section);
  };

  const shell = mountPlayerShell(
    parent,
    {
      setSpeed: ports.setSpeed,
      step: ports.step,
      selectTool: (mode) => {
        activeToolMode = mode;
        if (mode !== 'navigate') inspectSurface?.close();
        ports.selectTool(mode);
      },
      setTerraformBrush: ports.setTerraformBrush,
      onUndo: ports.undo,
      onInformationViews: openInformationViews,
      onBuildOpen: () => inspectSurface?.collapse(),
      onCity: () => {
        systemDialogs.openCity();
        appendLocaleSelector();
      },
      onSelectMetric: (metric) => {
        const route = shell.dialogHost.activeRoute;
        if (
          metric === 'population' ||
          metric === 'treasury' ||
          metric === 'net' ||
          metric === 'construction' ||
          metric === 'active' ||
          metric === 'total'
        ) {
          if (route?.key === 'city-overview') shell.dialogHost.close();
          else {
            systemDialogs.openCity();
            appendLocaleSelector();
          }
        } else if (
          metric === 'demand' ||
          metric === 'residentialDemand' ||
          metric === 'commercialDemand' ||
          metric === 'industrialDemand'
        ) {
          if (route?.key === 'population-rci') shell.dialogHost.close();
          else systemDialogs.openPopulationRci();
        } else {
          if (route?.key === 'simulation-time') shell.dialogHost.close();
          else systemDialogs.openSimulationTime();
        }
      },
      onGameMenu: openGameMenu,
    },
    locale,
  );

  inspectSurface = mountInspectSurface(shell.element, locale);

  applyLocale = (nextLocale: UiLocale): void => {
    locale = nextLocale;
    persistUiLocale(locale);
    shell.setLocale(locale);
    inspectSurface?.setLocale(locale);
    shell.dialogHost.refresh();
    appendLocaleSelector();
  };

  const systemDialogs = createCitySystemDialogs(shell.dialogHost, {
    getWorld: () => {
      if (latestWorld === null) throw new Error('city-ui:world-unavailable');
      return latestWorld;
    },
    rciRegistries: ports.rciRegistries,
    submitTaxPolicy: ports.submitTaxPolicy,
    openInformationViews,
    openGameMenu,
  });

  return Object.freeze({
    element: shell.element,
    dialogHost: shell.dialogHost,
    toolContextSheet: shell.toolContextSheet,
    selectTool(mode: GameToolMode): void {
      shell.selectTool(mode);
    },
    setSimulationSpeed(speed: Parameters<CityUiPorts['setSpeed']>[0]): void {
      shell.simulationControls.setSpeed(speed);
    },
    update(world: CommittedWorld): void {
      latestWorld = world;
      const economy = createEconomyViewProjection(world.economy);
      const rci = createRciHudModel(world.rci, ports.rciRegistries, world.simulation.absoluteTick);
      const time = createGameTimePresentation(world.simulation, world.buildings);
      shell.update({
        population: String(rci.population),
        treasury: economy.treasury,
        net: economy.net,
        demand: `R${demandSymbol(rci.residentialDemand)} C${demandSymbol(rci.commercialDemand)} I${demandSymbol(rci.industrialDemand)}`,
        residentialDemand: rci.residentialDemand,
        commercialDemand: rci.commercialDemand,
        industrialDemand: rci.industrialDemand,
        gameTime: time.calendarLabel,
        construction: String(time.constructionCount),
        active: String(time.activeCount),
        total: String(time.totalCount),
      });
      shell.dialogHost.update();
      appendLocaleSelector();
    },
    inspectCell(cell: Readonly<{ x: number; z: number }>): void {
      if (latestWorld === null || inspectSurface === null) return;
      if (activeToolMode !== 'navigate') {
        inspectSurface.close();
        return;
      }
      const target = pickInspectTarget(latestWorld, cell);
      inspectSurface.open(createInspectProjection(latestWorld, target, ports.rciRegistries));
    },
    dispose(): void {
      informationViews.deactivate();
      inspectSurface?.dispose();
      shell.dispose();
    },
  });
}
