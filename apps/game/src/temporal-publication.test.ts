import {
  createBuildingSnapshot,
  type ConstructionBuildingInstance,
} from '@web-three-city/building-core';
import { createFoundationRciRegistries } from '@web-three-city/rci-core';
import { createSimulationSnapshot } from '@web-three-city/simulation-core';
import { type TrafficGraph } from '@web-three-city/traffic-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../test/application-fixtures.js';
import {
  CommittedWorldStore,
  createCommittedWorld,
  createCommittedWorldFromDomainState,
  type CommittedWorld,
} from './application/committed-world.js';
import { fingerprintCommittedWorld } from './application/committed-world-fingerprint.js';
import { DefaultWorldTransactionCoordinator } from './application/world-transaction-coordinator.js';
import {
  commitGameMinuteTransaction,
  planGameMinuteTransaction,
} from './game-minute-transaction.js';
import {
  commitTrafficTransportTransaction,
  planTrafficTransportTransaction,
} from './traffic-transport-transaction.js';

type PublicationMode = 'legacy-per-commit' | 'reference-coalesced';

interface PresentationCounters {
  authorityCommitCount: number;
  fullPresentationCount: number;
  noOpPresentationCount: number;
  externalNotifyCount: number;
}

interface ScenarioResult {
  readonly world: CommittedWorld;
  readonly counters: PresentationCounters;
}

function worldAtMinute(absoluteGameMinute: number): CommittedWorld {
  const base = createApplicationFixture();
  return createCommittedWorld({
    ...base,
    simulation: createSimulationSnapshot({
      revision: absoluteGameMinute,
      absoluteGameMinute,
      growthSequence: base.simulation.growthSequence,
    }),
  });
}

function worldAtGrowthCompletion(): CommittedWorld {
  const base = createApplicationFixture({ withCommercialBuilding: true });
  const [activeBuilding] = base.buildings.instances;
  if (activeBuilding === undefined || activeBuilding.lifecycle !== 'active') {
    throw new Error('test:expected-active-building');
  }

  const construction: ConstructionBuildingInstance = {
    ...activeBuilding,
    lifecycle: 'construction',
    constructionStartedAtTick: 8,
    constructionCompletesAtTick: 9,
  };
  const buildings = createBuildingSnapshot(
    { revision: base.buildings.revision, instances: [construction] },
    WORLD_CONFIG,
  );
  const simulation = createSimulationSnapshot({
    revision: 539,
    absoluteGameMinute: 8 * 60 + 59,
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

function emptyTrafficGraph(world: CommittedWorld): TrafficGraph {
  return Object.freeze({
    sourceRoadRevision: world.roads.revision,
    sourceBuildingRevision: world.buildings.revision,
    nodes: Object.freeze([]),
    edges: Object.freeze([]),
  });
}

function presentationPort(counters: PresentationCounters, kind: 'full' | 'no-op') {
  return {
    synchronize() {
      if (kind === 'full') counters.fullPresentationCount += 1;
      else counters.noOpPresentationCount += 1;
    },
    rebuildFromCommitted() {
      if (kind === 'full') counters.fullPresentationCount += 1;
      else counters.noOpPresentationCount += 1;
    },
  };
}

function runScenario(before: CommittedWorld, mode: PublicationMode): ScenarioResult {
  const coordinator = new DefaultWorldTransactionCoordinator({
    worldStore: new CommittedWorldStore(before),
  });
  const counters: PresentationCounters = {
    authorityCommitCount: 0,
    fullPresentationCount: 0,
    noOpPresentationCount: 0,
    externalNotifyCount: 0,
  };
  const intermediatePresentation = presentationPort(
    counters,
    mode === 'legacy-per-commit' ? 'full' : 'no-op',
  );

  const minutePlan = planGameMinuteTransaction({
    world: coordinator.snapshot(),
    registries: createFoundationRciRegistries(),
  });
  const minuteCommit = commitGameMinuteTransaction(
    coordinator,
    minutePlan,
    intermediatePresentation,
  );
  expect(minuteCommit.status).toBe('committed');
  if (minuteCommit.status !== 'committed') throw new Error('test:minute-commit-rejected');
  counters.authorityCommitCount += 1;
  if (mode === 'legacy-per-commit') counters.externalNotifyCount += 1;

  for (let quantum = 0; quantum < 4; quantum += 1) {
    const current = coordinator.snapshot();
    const transportPlan = planTrafficTransportTransaction({
      world: current,
      mobility: current.mobility,
      traffic: current.traffic,
      graph: emptyTrafficGraph(current),
    });
    const presentation =
      mode === 'reference-coalesced' && quantum === 3
        ? presentationPort(counters, 'full')
        : intermediatePresentation;
    const transportCommit = commitTrafficTransportTransaction(
      coordinator,
      transportPlan,
      presentation,
    );
    expect(transportCommit.status).toBe('committed');
    if (transportCommit.status !== 'committed') {
      throw new Error(`test:transport-commit-rejected:${quantum + 1}`);
    }
    counters.authorityCommitCount += 1;
    if (mode === 'legacy-per-commit') counters.externalNotifyCount += 1;
  }

  if (mode === 'reference-coalesced') {
    counters.externalNotifyCount += 1;
  }

  return Object.freeze({ world: coordinator.snapshot(), counters });
}

function canonical(value: unknown): unknown {
  if (value instanceof Uint8Array) return [...value];
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => typeof entry !== 'function' && entry !== undefined)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

function environmentProvenance(world: CommittedWorld) {
  return {
    road: {
      terrainRevision: world.environments.road.terrainRevision,
      waterSourceTerrainRevision: world.environments.road.waterSourceTerrainRevision,
    },
    zone: {
      terrainRevision: world.environments.zone.terrainRevision,
      waterSourceTerrainRevision: world.environments.zone.waterSourceTerrainRevision,
      roadRevision: world.environments.zone.roadRevision,
      occupancyRevision: world.environments.zone.occupancyRevision,
    },
    building: {
      terrainRevision: world.environments.building.terrainRevision,
      waterSourceTerrainRevision: world.environments.building.waterSourceTerrainRevision,
      roadRevision: world.environments.building.roadRevision,
      zoneRevision: world.environments.building.zoneRevision,
    },
    traffic: {
      graphSourceRoadRevision: world.traffic.graphSourceRoadRevision,
      graphSourceBuildingRevision: world.traffic.graphSourceBuildingRevision,
    },
  };
}

function expectSemanticParity(legacy: ScenarioResult, coalesced: ScenarioResult): void {
  expect(fingerprintCommittedWorld(legacy.world)).toBe(fingerprintCommittedWorld(coalesced.world));
  expect(legacy.world.revision).toBe(coalesced.world.revision);

  for (const component of [
    'simulation',
    'buildings',
    'rci',
    'economy',
    'mobility',
    'traffic',
    'terrain',
    'water',
    'roads',
    'zones',
  ] as const) {
    expect(canonical(legacy.world[component])).toEqual(canonical(coalesced.world[component]));
  }
  expect(environmentProvenance(legacy.world)).toEqual(environmentProvenance(coalesced.world));
}

describe('temporal publication parity', () => {
  it.each([
    ['dynamic-only minute', worldAtMinute(8 * 60 + 58)],
    ['08:59→09:00 Growth completion', worldAtGrowthCompletion()],
  ])('%s has legacy/coalesced semantic parity', (_name, before) => {
    const legacy = runScenario(before, 'legacy-per-commit');
    const coalesced = runScenario(before, 'reference-coalesced');

    expectSemanticParity(legacy, coalesced);
    expect(legacy.counters).toEqual({
      authorityCommitCount: 5,
      fullPresentationCount: 5,
      noOpPresentationCount: 0,
      externalNotifyCount: 5,
    });
    expect(coalesced.counters).toEqual({
      authorityCommitCount: 5,
      fullPresentationCount: 1,
      noOpPresentationCount: 4,
      externalNotifyCount: 1,
    });
  });
});
