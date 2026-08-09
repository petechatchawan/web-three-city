import type { EconomyTaxPolicy, EconomyPolicyUiResult } from '../../economy-budget-hud.js';
import { createEconomyViewProjection } from '../../economy-budget-hud.js';
import { createGameTimePresentation } from '../../game-time-presentation.js';
import { createRciHudModel } from '../../rci-hud.js';
import type { CommittedWorld } from '../../application/committed-world.js';
import type { RciDefinitionRegistries } from '@web-three-city/rci-core';
import { occupiedRoadCellCount } from '@web-three-city/road-core';
import { zoneCounts } from '@web-three-city/zone-core';
import { createButton } from '../components/button.js';
import type { DialogHost } from '../dialog/dialog-host.js';

export interface CitySystemDialogPorts {
  readonly getWorld: () => CommittedWorld;
  readonly rciRegistries: RciDefinitionRegistries;
  readonly submitTaxPolicy: (policy: EconomyTaxPolicy) => EconomyPolicyUiResult;
}

export interface CitySystemDialogs {
  openCity(): void;
  openEconomyTaxation(): void;
  openPopulationRci(): void;
  openSimulationTime(): void;
}

function metric(parent: HTMLElement, label: string, value: string | number): void {
  const row = document.createElement('p');
  const name = document.createElement('span');
  const output = document.createElement('strong');
  name.textContent = label;
  output.textContent = String(value);
  row.append(name, output);
  parent.append(row);
}

export function createCitySystemDialogs(
  host: DialogHost,
  ports: CitySystemDialogPorts,
): CitySystemDialogs {
  let taxDraft: EconomyTaxPolicy | null = null;
  let taxStatus = '';

  const renderOverview = (body: HTMLElement): void => {
    const world = ports.getWorld();
    const rci = createRciHudModel(world.rci, ports.rciRegistries, world.simulation.absoluteTick);
    const economy = createEconomyViewProjection(world.economy);
    const heading = document.createElement('h3');
    heading.textContent = 'City Overview';
    body.append(heading);
    metric(body, 'Population', rci.population);
    metric(body, 'Households', rci.households);
    metric(body, 'Housing', rci.housing);
    metric(body, 'Employment', rci.employment);
    metric(body, 'Treasury', economy.treasury);
    metric(body, 'Net', economy.net);
    metric(
      body,
      'GameTime',
      createGameTimePresentation(world.simulation, world.buildings).calendarLabel,
    );
    const navigation = document.createElement('nav');
    navigation.setAttribute('aria-label', 'City systems');
    const entries = [
      ['economy', 'Economy', renderEconomyOverview],
      ['population-rci', 'Population / RCI', renderPopulation],
      ['zoning', 'Zoning', renderZoning],
      ['roads', 'Roads', renderRoads],
    ] as const;
    for (const [key, label, render] of entries) {
      const button = createButton(label, () =>
        host.push({ kind: 'system', key, title: label }, render),
      );
      button.dataset.system = key;
      navigation.append(button);
    }
    body.append(navigation);
  };

  const renderEconomyOverview = (body: HTMLElement): void => {
    const model = createEconomyViewProjection(ports.getWorld().economy);
    const tabs = document.createElement('div');
    tabs.setAttribute('role', 'tablist');
    tabs.append(
      createButton('Overview', () => undefined),
      createButton('Taxation', () =>
        host.push(
          { kind: 'system', key: 'economy-taxation', title: 'Economy · Taxation' },
          renderTaxation,
        ),
      ),
    );
    body.append(tabs);
    metric(body, 'Treasury', model.treasury);
    metric(body, 'Income', model.income);
    metric(body, 'Expenses', model.expenses);
    metric(body, 'Net', model.net);
    metric(body, 'Current period', model.currentPeriodLabel);
    metric(body, 'Previous period', model.previousPeriodLabel);
    metric(body, 'Residential revenue', model.residentialRevenue);
    metric(body, 'Commercial revenue', model.commercialRevenue);
    metric(body, 'Industrial revenue', model.industrialRevenue);
    metric(body, 'Road maintenance', model.roadExpenses);
    metric(body, 'Player actions', model.actionExpenses);
  };

  const renderTaxation = (body: HTMLElement): void => {
    const model = createEconomyViewProjection(ports.getWorld().economy);
    const draft = taxDraft ?? {
      residentialBp: model.residentialPercent * 100,
      commercialBp: model.commercialPercent * 100,
      industrialBp: model.industrialPercent * 100,
    };
    const fields = [
      ['Residential', 'tax-residential', 'residentialBp'],
      ['Commercial', 'tax-commercial', 'commercialBp'],
      ['Industrial', 'tax-industrial', 'industrialBp'],
    ] as const;
    const selects = new Map<keyof EconomyTaxPolicy, HTMLSelectElement>();
    for (const [labelText, testId, key] of fields) {
      const label = document.createElement('label');
      label.textContent = labelText;
      const select = document.createElement('select');
      select.dataset.testid = testId;
      select.setAttribute('aria-label', `${labelText} tax rate`);
      for (let rate = 0; rate <= 20; rate += 1) {
        const option = document.createElement('option');
        option.value = String(rate);
        option.textContent = `${rate}%`;
        select.append(option);
      }
      select.value = String(draft[key] / 100);
      select.addEventListener('change', () => {
        taxDraft = {
          residentialBp: Number(selects.get('residentialBp')?.value ?? 0) * 100,
          commercialBp: Number(selects.get('commercialBp')?.value ?? 0) * 100,
          industrialBp: Number(selects.get('industrialBp')?.value ?? 0) * 100,
        };
      });
      selects.set(key, select);
      label.append(select);
      body.append(label);
    }
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = taxStatus;
    const apply = createButton('Apply tax policy', () => {
      const policy = {
        residentialBp: Number(selects.get('residentialBp')!.value) * 100,
        commercialBp: Number(selects.get('commercialBp')!.value) * 100,
        industrialBp: Number(selects.get('industrialBp')!.value) * 100,
      };
      const result = ports.submitTaxPolicy(policy);
      taxStatus = result.status === 'accepted' ? 'Tax policy updated' : 'Tax policy rejected';
      if (result.status === 'accepted') taxDraft = null;
      host.update();
    });
    apply.dataset.testid = 'apply-tax-policy';
    body.append(apply, status);
  };

  const renderPopulation = (body: HTMLElement): void => {
    const world = ports.getWorld();
    const model = createRciHudModel(world.rci, ports.rciRegistries, world.simulation.absoluteTick);
    metric(body, 'Population', model.population);
    metric(body, 'Households', model.households);
    metric(body, 'Housing', model.housing);
    metric(body, 'Employment', model.employment);
    metric(body, 'Residential demand', model.residentialDemand);
    metric(body, 'Commercial demand', model.commercialDemand);
    metric(body, 'Industrial demand', model.industrialDemand);
  };

  const renderZoning = (body: HTMLElement): void => {
    const world = ports.getWorld();
    const counts = zoneCounts(world.zones);
    metric(body, 'Residential zones', counts.residential);
    metric(body, 'Commercial zones', counts.commercial);
    metric(body, 'Industrial zones', counts.industrial);
  };

  const renderRoads = (body: HTMLElement): void => {
    metric(body, 'Road cells', occupiedRoadCellCount(ports.getWorld().roads));
  };

  const renderSimulationTime = (body: HTMLElement): void => {
    const world = ports.getWorld();
    metric(
      body,
      'Calendar',
      createGameTimePresentation(world.simulation, world.buildings).calendarLabel,
    );
    metric(body, 'Tick', world.simulation.absoluteTick);
  };

  return Object.freeze({
    openCity(): void {
      host.open({ kind: 'system', key: 'city-overview', title: 'City' }, renderOverview);
    },
    openEconomyTaxation(): void {
      host.open(
        { kind: 'system', key: 'economy-taxation', title: 'Economy · Taxation' },
        renderTaxation,
      );
    },
    openPopulationRci(): void {
      host.open(
        { kind: 'system', key: 'population-rci', title: 'Population / RCI' },
        renderPopulation,
      );
    },
    openSimulationTime(): void {
      host.open(
        { kind: 'system', key: 'simulation-time', title: 'Simulation Time' },
        renderSimulationTime,
      );
    },
  });
}
