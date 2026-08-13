import type { RciDefinitionRegistries } from '@web-three-city/rci-core';
import { occupiedRoadCellCount } from '@web-three-city/road-core';
import { zoneCounts } from '@web-three-city/zone-core';
import type { CommittedWorld } from '../../application/committed-world.js';
import type { EconomyTaxPolicy, EconomyPolicyUiResult } from '../../economy-budget-hud.js';
import { createEconomyViewProjection } from '../../economy-budget-hud.js';
import { createGameTimePresentation } from '../../game-time-presentation.js';
import { createRciHudModel } from '../../rci-hud.js';
import { createButton } from '../components/button.js';
import { createCityIcon, type CityIconName } from '../components/icon.js';
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
  row.className = 'city-detail-row';
  const name = document.createElement('span');
  const output = document.createElement('strong');
  name.textContent = label;
  output.textContent = String(value);
  row.append(name, output);
  parent.append(row);
}

function kpiCard(
  parent: HTMLElement,
  label: string,
  value: string | number,
  icon: CityIconName,
): void {
  const card = document.createElement('article');
  card.className = 'city-kpi-card';
  const iconWrap = document.createElement('span');
  iconWrap.className = 'city-kpi-icon';
  iconWrap.append(createCityIcon(icon));
  const copy = document.createElement('div');
  const labelNode = document.createElement('span');
  labelNode.className = 'city-kpi-label';
  labelNode.textContent = label;
  const valueNode = document.createElement('strong');
  valueNode.className = 'city-kpi-value';
  valueNode.textContent = String(value);
  copy.append(labelNode, valueNode);
  card.append(iconWrap, copy);
  parent.append(card);
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
    const time = createGameTimePresentation(world.simulation, world.buildings);

    const heading = document.createElement('h3');
    heading.className = 'city-section-title';
    heading.textContent = 'City Overview';
    body.append(heading);

    const kpis = document.createElement('section');
    kpis.className = 'city-kpi-grid';
    kpiCard(kpis, 'Population', rci.population, 'population');
    kpiCard(kpis, 'Treasury', economy.treasury, 'treasury');
    kpiCard(kpis, 'Net', economy.net, 'net');
    body.append(kpis);

    const details = document.createElement('section');
    details.className = 'city-card city-detail-card';
    metric(details, 'Households', rci.households);
    metric(details, 'Housing', rci.housing);
    metric(details, 'Employment', rci.employment);
    metric(details, 'GameTime', time.calendarLabel);
    body.append(details);

    const systemsHeading = document.createElement('h3');
    systemsHeading.className = 'city-section-title';
    systemsHeading.textContent = 'City systems';
    body.append(systemsHeading);

    const navigation = document.createElement('nav');
    navigation.className = 'city-system-grid';
    navigation.setAttribute('aria-label', 'City systems');
    const entries = [
      ['economy', 'Economy', 'treasury', renderEconomyOverview],
      ['population-rci', 'Population / RCI', 'population', renderPopulation],
      ['zoning', 'Zoning', 'zones', renderZoning],
      ['roads', 'Roads', 'roads', renderRoads],
    ] as const;
    for (const [key, label, icon, render] of entries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'city-sheet-action';
      button.dataset.system = key;
      button.append(createCityIcon(icon));
      const text = document.createElement('span');
      text.textContent = label;
      button.append(text);
      button.addEventListener('click', () =>
        host.push({ kind: 'system', key, title: label, live: true }, render),
      );
      navigation.append(button);
    }
    body.append(navigation);
  };

  const renderEconomyOverview = (body: HTMLElement): void => {
    const model = createEconomyViewProjection(ports.getWorld().economy);
    const tabs = document.createElement('div');
    tabs.className = 'city-segment-group city-dialog-tabs';
    tabs.setAttribute('role', 'tablist');
    const overview = createButton('Overview', () => undefined);
    overview.className = 'city-segment is-active';
    const taxation = createButton('Taxation', () =>
      host.push(
        { kind: 'system', key: 'economy-taxation', title: 'Economy · Taxation', live: true },
        renderTaxation,
      ),
    );
    taxation.className = 'city-segment';
    tabs.append(overview, taxation);
    body.append(tabs);

    const card = document.createElement('section');
    card.className = 'city-card city-detail-card';
    metric(card, 'Treasury', model.treasury);
    metric(card, 'Income', model.income);
    metric(card, 'Expenses', model.expenses);
    metric(card, 'Net', model.net);
    metric(card, 'Current period', model.currentPeriodLabel);
    metric(card, 'Previous period', model.previousPeriodLabel);
    metric(card, 'Residential revenue', model.residentialRevenue);
    metric(card, 'Commercial revenue', model.commercialRevenue);
    metric(card, 'Industrial revenue', model.industrialRevenue);
    metric(card, 'Road maintenance', model.roadExpenses);
    metric(card, 'Player actions', model.actionExpenses);
    body.append(card);
  };

  const renderTaxation = (body: HTMLElement): void => {
    const model = createEconomyViewProjection(ports.getWorld().economy);
    const draft = taxDraft ?? {
      residentialBp: model.residentialPercent * 100,
      commercialBp: model.commercialPercent * 100,
      industrialBp: model.industrialPercent * 100,
    };
    const form = document.createElement('section');
    form.className = 'city-card city-form-card';
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
      form.append(label);
    }

    const status = document.createElement('p');
    status.className = 'city-form-status';
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
    apply.className = 'city-primary-button';
    apply.dataset.testid = 'apply-tax-policy';
    form.append(apply, status);
    body.append(form);
  };

  const renderPopulation = (body: HTMLElement): void => {
    const world = ports.getWorld();
    const model = createRciHudModel(world.rci, ports.rciRegistries, world.simulation.absoluteTick);
    const card = document.createElement('section');
    card.className = 'city-card city-detail-card';
    metric(card, 'Population', model.population);
    metric(card, 'Households', model.households);
    metric(card, 'Housing', model.housing);
    metric(card, 'Employment', model.employment);
    metric(card, 'Residential demand', model.residentialDemand);
    metric(card, 'Commercial demand', model.commercialDemand);
    metric(card, 'Industrial demand', model.industrialDemand);
    body.append(card);
  };

  const renderZoning = (body: HTMLElement): void => {
    const counts = zoneCounts(ports.getWorld().zones);
    const card = document.createElement('section');
    card.className = 'city-card city-detail-card';
    metric(card, 'Residential zones', counts.residential);
    metric(card, 'Commercial zones', counts.commercial);
    metric(card, 'Industrial zones', counts.industrial);
    body.append(card);
  };

  const renderRoads = (body: HTMLElement): void => {
    const card = document.createElement('section');
    card.className = 'city-card city-detail-card';
    metric(card, 'Road cells', occupiedRoadCellCount(ports.getWorld().roads));
    body.append(card);
  };

  const renderSimulationTime = (body: HTMLElement): void => {
    const world = ports.getWorld();
    const card = document.createElement('section');
    card.className = 'city-card city-detail-card';
    metric(
      card,
      'Calendar',
      createGameTimePresentation(world.simulation, world.buildings).calendarLabel,
    );
    metric(card, 'Tick', world.simulation.absoluteTick);
    body.append(card);
  };

  return Object.freeze({
    openCity(): void {
      host.open(
        { kind: 'system', key: 'city-overview', title: 'City', live: true },
        renderOverview,
      );
    },
    openEconomyTaxation(): void {
      host.open(
        { kind: 'system', key: 'economy-taxation', title: 'Economy · Taxation', live: true },
        renderTaxation,
      );
    },
    openPopulationRci(): void {
      host.open(
        { kind: 'system', key: 'population-rci', title: 'Population / RCI', live: true },
        renderPopulation,
      );
    },
    openSimulationTime(): void {
      host.open(
        { kind: 'system', key: 'simulation-time', title: 'Simulation Time', live: true },
        renderSimulationTime,
      );
    },
  });
}
