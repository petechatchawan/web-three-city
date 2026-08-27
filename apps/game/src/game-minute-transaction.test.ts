import {
  createBuildingSnapshot,
  type ConstructionBuildingInstance,
} from '@web-three-city/building-core';
import {
  createInitialSimulationSnapshot,
  createSimulationSnapshot,
  gameMinuteValue,
  macroHourIndex,
} from '@web-three-city/simulation-core';
import { createFoundationRciRegistries } from '@web-three-city/rci-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../test/application-fixtures.js';
import {
  CommittedWorldStore,
  createCommittedWorld,
  createCommittedWorldFromDomainState,
} from './application/committed-world.js';
import { DefaultWorldTransactionCoordinator } from './application/world-transaction-coordinator.js';
import {
  commitGameMinuteTransaction,
  executeGameMinuteTransaction,
  planGameMinuteTransaction,
} from './game-minute-transaction.js';

function worldAtMinute(absoluteGameMinute: number) {
  const base = createApplicationFixture();
  return createCommittedWorld({
    ...base,
    simulation: createSimulationSnapshot({
      revision:
        absoluteGameMinute - gameMinuteValue(createInitialSimulationSnapshot().absoluteGameMinute),
      absoluteGameMinute,
      growthSequence: base.simulation.growthSequence,
    }),
  });
}

function worldAtGrowthCompletion() {
  const base = createApplicationFixture({ withCommercialBuilding: true });
  const [activeBuilding] = base.buildings.instances;
  if (activeBuilding === undefined || activeBuilding.lifecycle !== 'active') {
    throw new Error('test:expected-active-building');
  }

  const construction: ConstructionBuildingInstance = {
    ...activeBuilding,
    lifecycle: 'construction',
    constructionStartedAtMacroHourIndex: macroHourIndex(12),
    constructionCompletesAtMacroHourIndex: macroHourIndex(18),
  };
  const buildings = createBuildingSnapshot(
    { revision: base.buildings.revision, instances: [construction] },
    WORLD_CONFIG,
  );
  const simulation = createSimulationSnapshot({
    revision: 17 * 60 + 59,
    absoluteGameMinute: 17 * 60 + 59,
    growthSequence: base.simulation.growthSequence,
  });

  return createCommittedWorldFromDomainState({
    revision: base.revision,
    terrain: base.terrain,
    roads: base.roads,
    zones: base.zones,
    buildings,
    simulation,
    rci: base.rci,
    economy: base.economy,
    mobility: base.mobility,
    traffic: base.traffic,
  });
}

describe('Game minute transaction', () => {
  it('advances a non-hour minute without running macro consumers', () => {
    const before = worldAtMinute(8 * 60 + 1);
    const plan = planGameMinuteTransaction({
      world: before,
      registries: createFoundationRciRegistries(),
    });

    expect(plan.valid).toBe(true);
    expect(plan.nextWorld.simulation.absoluteGameMinute).toBe(8 * 60 + 2);
    expect(plan.nextWorld.buildings.revision).toBe(before.buildings.revision);
    expect(plan.nextWorld.rci.revision).toBe(before.rci.revision);
    expect(plan.nextWorld.economy.revision).toBe(before.economy.revision);
    expect((plan.nextWorld.traffic as unknown as { schemaVersion: number }).schemaVersion).toBe(2);
    expect(
      (plan.nextWorld.traffic as unknown as { timeCursor: { sourceGameMinute: number } }).timeCursor
        .sourceGameMinute,
    ).toBe(8 * 60 + 2);
  });

  it('reuses immutable static authority for a minute without static changes', () => {
    const before = worldAtMinute(8 * 60 + 1);
    const plan = planGameMinuteTransaction({
      world: before,
      registries: createFoundationRciRegistries(),
    });

    expect(plan.valid).toBe(true);
    expect(plan.nextWorld.terrain).toBe(before.terrain);
    expect(plan.nextWorld.water).toBe(before.water);
    expect(plan.nextWorld.roads).toBe(before.roads);
    expect(plan.nextWorld.zones).toBe(before.zones);
    expect(plan.nextWorld.environments).toBe(before.environments);
  });

  it('runs macro consumers once when 08:59 advances to 09:00', () => {
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(worldAtMinute(8 * 60 + 59)),
    });

    const plan = planGameMinuteTransaction({
      world: coordinator.snapshot(),
      registries: createFoundationRciRegistries(),
    });
    const committed = executeGameMinuteTransaction({
      coordinator,
      registries: createFoundationRciRegistries(),
    });

    expect(committed.status).toBe('committed');
    if (committed.status !== 'committed') return;
    expect(committed.world.simulation.absoluteGameMinute).toBe(9 * 60);
    expect(committed.world.simulation.revision).toBe(60);
    expect(plan.rciReceipt).toMatchObject({
      beforeAbsoluteMacroHourIndex: 8,
      afterAbsoluteMacroHourIndex: 9,
    });
  });

  it('reconciles static environment provenance when Growth completes at 18:00', () => {
    const before = worldAtGrowthCompletion();
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(before),
    });
    const plan = planGameMinuteTransaction({
      world: coordinator.snapshot(),
      registries: createFoundationRciRegistries(),
    });

    expect(plan.invalidReason).toBeNull();
    expect(plan.valid).toBe(true);
    expect(plan.buildingReceipt).toMatchObject({
      beforeMacroHourIndex: macroHourIndex(17),
      afterMacroHourIndex: macroHourIndex(18),
      completedInstanceIds: ['building:commercial:1'],
    });

    const committed = commitGameMinuteTransaction(coordinator, plan);
    expect(committed.status).toBe('committed');
    if (committed.status !== 'committed') return;

    const after = committed.world;
    expect(after.buildings.instances[0]).toMatchObject({
      lifecycle: 'active',
      activatedAtMacroHourIndex: macroHourIndex(18),
    });
    expect(after.buildings.revision).toBeGreaterThan(before.buildings.revision);
    expect(after.environments.zone.occupancyRevision).toBe(after.buildings.revision);
    expect(after.environments.building.terrainRevision).toBe(after.terrain.revision);
    expect(after.environments.building.waterSourceTerrainRevision).toBe(
      after.water.sourceTerrainRevision,
    );
    expect(after.environments.building.roadRevision).toBe(after.roads.revision);
    expect(after.environments.building.zoneRevision).toBe(after.zones.revision);
    expect(after.traffic.graphSourceBuildingRevision).toBe(after.buildings.revision);
  });
});
