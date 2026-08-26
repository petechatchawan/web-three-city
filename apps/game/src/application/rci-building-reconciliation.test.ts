import { createEmptyBuildingSnapshot } from '@web-three-city/building-core';
import { createFoundationRciRegistries } from '@web-three-city/rci-core';
import { deriveMacroHourIndex } from '@web-three-city/simulation-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../../test/application-fixtures.js';
import { reconcileRciForBuildingChange } from './rci-building-reconciliation.js';

describe('reconcileRciForBuildingChange', () => {
  it('retires workplace inventory before a bulldozed commercial Building can publish', () => {
    const before = createApplicationFixture({ withCommercialBuilding: true });
    const afterBuildings = createEmptyBuildingSnapshot(WORLD_CONFIG);
    expect(
      before.rci.employment.workplaces.some(
        (workplace) => workplace.retiredAtMacroHourIndex === null,
      ),
    ).toBe(true);

    const reconciled = reconcileRciForBuildingChange({
      rci: before.rci,
      buildingsBefore: before.buildings,
      buildingsAfter: afterBuildings,
      registries: createFoundationRciRegistries(),
      evaluationMacroHourIndex: deriveMacroHourIndex(before.simulation.absoluteGameMinute),
    });

    expect(reconciled.employment.workplaces).toHaveLength(1);
    expect(reconciled.employment.workplaces[0]?.retiredAtMacroHourIndex).toBe(
      deriveMacroHourIndex(before.simulation.absoluteGameMinute),
    );
  });
});
