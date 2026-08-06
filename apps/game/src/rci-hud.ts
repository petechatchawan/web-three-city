import {
  createRciProjection,
  type RciDefinitionRegistries,
  type RciSnapshot,
} from '@web-three-city/rci-core';

export interface RciHudModel {
  readonly population: number;
  readonly households: number;
  readonly housing: string;
  readonly employment: string;
  readonly residentialDemand: number;
  readonly commercialDemand: number;
  readonly industrialDemand: number;
  readonly residentialGateOpen: boolean;
  readonly commercialGateOpen: boolean;
  readonly industrialGateOpen: boolean;
}

function demandPoints(valueMilli: number): number {
  return Math.round(valueMilli / 1_000);
}

export function createRciHudModel(
  snapshot: RciSnapshot,
  registries: RciDefinitionRegistries,
  evaluationTick: number,
): RciHudModel {
  const projection = createRciProjection(snapshot, registries, evaluationTick);
  return Object.freeze({
    population: projection.population.residentCount,
    households: projection.population.householdCount,
    housing: `${projection.housing.occupiedDwellingCount}/${projection.housing.activeDwellingCount}`,
    employment: `${projection.employment.employedResidentCount}/${projection.employment.workingAgeResidentCount}`,
    residentialDemand: demandPoints(snapshot.demand.demand.residentialMilli),
    commercialDemand: demandPoints(snapshot.demand.demand.commercialMilli),
    industrialDemand: demandPoints(snapshot.demand.demand.industrialMilli),
    residentialGateOpen: snapshot.demand.growthGates.residentialOpen,
    commercialGateOpen: snapshot.demand.growthGates.commercialOpen,
    industrialGateOpen: snapshot.demand.growthGates.industrialOpen,
  });
}

function demandLabel(value: number, open: boolean): string {
  const signed = value > 0 ? `+${value}` : String(value);
  return `${signed} ${open ? 'open' : 'closed'}`;
}

export interface RciHudAdapter {
  readonly element: HTMLElement;
  update(
    snapshot: RciSnapshot,
    registries: RciDefinitionRegistries,
    evaluationTick: number,
  ): void;
  dispose(): void;
}

export function mountRciHud(panel: HTMLElement): RciHudAdapter {
  const section = document.createElement('section');
  section.className = 'rci-hud-summary';
  section.setAttribute('aria-label', 'RCI city statistics');
  section.dataset.worldInputBlock = '';
  section.innerHTML = `
    <p class="control-label">City statistics</p>
    <div class="metrics-grid rci-metrics">
      <div class="metrics-row"><span>Population</span><strong data-testid="rci-population">0</strong></div>
      <div class="metrics-row"><span>Households</span><strong data-testid="rci-households">0</strong></div>
      <div class="metrics-row"><span>Housing</span><strong data-testid="rci-housing">0/0</strong></div>
      <div class="metrics-row"><span>Employment</span><strong data-testid="rci-employment">0/0</strong></div>
      <div class="metrics-row rci-demand-row" aria-label="RCI demand">
        <span>Demand</span>
        <strong>
          R <span data-testid="rci-demand-residential">0 closed</span>
          C <span data-testid="rci-demand-commercial">0 closed</span>
          I <span data-testid="rci-demand-industrial">0 closed</span>
        </strong>
      </div>
    </div>
  `;
  panel.append(section);

  const requireValue = (testId: string): HTMLElement => {
    const element = section.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (element === null) throw new Error(`rci-hud:missing-element:${testId}`);
    return element;
  };
  const population = requireValue('rci-population');
  const households = requireValue('rci-households');
  const housing = requireValue('rci-housing');
  const employment = requireValue('rci-employment');
  const residential = requireValue('rci-demand-residential');
  const commercial = requireValue('rci-demand-commercial');
  const industrial = requireValue('rci-demand-industrial');

  return Object.freeze({
    element: section,
    update(snapshot, registries, evaluationTick): void {
      const model = createRciHudModel(snapshot, registries, evaluationTick);
      population.textContent = String(model.population);
      households.textContent = String(model.households);
      housing.textContent = model.housing;
      employment.textContent = model.employment;
      residential.textContent = demandLabel(
        model.residentialDemand,
        model.residentialGateOpen,
      );
      commercial.textContent = demandLabel(
        model.commercialDemand,
        model.commercialGateOpen,
      );
      industrial.textContent = demandLabel(
        model.industrialDemand,
        model.industrialGateOpen,
      );
    },
    dispose(): void {
      section.remove();
    },
  });
}
