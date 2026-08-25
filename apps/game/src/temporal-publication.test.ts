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
import {
  DefaultWorldTransactionCoordinator,
  type WorldTransactionCoordinator,
} from './application/world-transaction-coordinator.js';
import { createTemporalPublicationController } from './temporal-publication-controller.js';
import {
  commitGameMinuteTransaction,
  planGameMinuteTransaction,
} from './game-minute-transaction.js';
import {
  commitTrafficTransportTransaction,
  planTrafficTransportTransaction,
} from './traffic-transport-transaction.js';

type PublicationMode = 'legacy-per-commit' | 'reference-coalesced';
type A2PublicationMode = 'legacy-per-commit' | 'coalesced';

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

interface A2CadenceCounters {
  authorityPublishCount: number;
  completePresentationCount: number;
  fullStaticSyncCount: number;
  externalNotifyCount: number;
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

function staticAuthorityChanged(before: CommittedWorld, after: CommittedWorld): boolean {
  return (
    JSON.stringify(
      canonical({
        terrain: before.terrain,
        water: before.water,
        roads: before.roads,
        zones: before.zones,
        buildings: before.buildings,
        environments: environmentProvenance(before),
      }),
    ) !==
    JSON.stringify(
      canonical({
        terrain: after.terrain,
        water: after.water,
        roads: after.roads,
        zones: after.zones,
        buildings: after.buildings,
        environments: environmentProvenance(after),
      }),
    )
  );
}

function countingCoordinator(
  before: CommittedWorld,
  counters: A2CadenceCounters,
  completePresentation: {
    synchronize(world: CommittedWorld): void;
    rebuildFromCommitted(world: CommittedWorld): void;
  },
): WorldTransactionCoordinator {
  const delegate = new DefaultWorldTransactionCoordinator({
    worldStore: new CommittedWorldStore(before),
    presentation: completePresentation,
  });
  return {
    snapshot: () => delegate.snapshot(),
    snapshotForTransaction: () => delegate.snapshotForTransaction(),
    publish(plan) {
      counters.authorityPublishCount += 1;
      return delegate.publish(plan);
    },
    publishForTransaction(plan) {
      counters.authorityPublishCount += 1;
      return delegate.publishForTransaction(plan);
    },
    publishBatchForTransaction(plans) {
      counters.authorityPublishCount += plans.length;
      return delegate.publishBatchForTransaction(plans);
    },
    replaceFromDecodedWorld(world) {
      return delegate.replaceFromDecodedWorld(world);
    },
  };
}

function runPublicationCadence(
  before: CommittedWorld,
  mode: A2PublicationMode,
): {
  readonly before: CommittedWorld;
  readonly world: CommittedWorld;
  readonly counters: A2CadenceCounters;
} {
  const counters: A2CadenceCounters = {
    authorityPublishCount: 0,
    completePresentationCount: 0,
    fullStaticSyncCount: 0,
    externalNotifyCount: 0,
  };
  const completePresentation = {
    synchronize(world: CommittedWorld) {
      counters.completePresentationCount += 1;
      counters.fullStaticSyncCount += 1;
      void world;
    },
    rebuildFromCommitted(world: CommittedWorld) {
      counters.completePresentationCount += 1;
      counters.fullStaticSyncCount += 1;
      void world;
    },
  };
  const finalDynamicPresentation = {
    synchronize(world: CommittedWorld) {
      counters.completePresentationCount += 1;
      void world;
    },
    rebuildFromCommitted(world: CommittedWorld) {
      counters.completePresentationCount += 1;
      void world;
    },
  };
  const intermediatePresentation = {
    synchronize(world: CommittedWorld) {
      void world;
    },
    rebuildFromCommitted(world: CommittedWorld) {
      void world;
    },
  };
  const coordinator = countingCoordinator(before, counters, completePresentation);
  const batchStart = coordinator.snapshotForTransaction();
  const notifyCommittedWorld = (world: CommittedWorld): void => {
    void world;
    counters.externalNotifyCount += 1;
  };
  const controller = createTemporalPublicationController({
    coordinator,
    registries: createFoundationRciRegistries(),
    graphForWorld: emptyTrafficGraph,
    reservedCells: () => Object.freeze([]),
    intermediatePresentation,
    finalDynamicPresentation,
    completePresentation,
    presentationSuppressed: () => false,
    adoptCommittedWorld: notifyCommittedWorld,
  });

  let world: CommittedWorld;
  if (mode === 'legacy-per-commit') {
    world = controller.advanceGameMinute();
    for (let quantum = 0; quantum < 4; quantum += 1) {
      world = controller.advanceTransportQuantum();
    }
  } else {
    const result = controller.advanceTemporalMinute();
    if (result.status !== 'committed') throw new Error(`test:temporal-rejected:${result.reason}`);
    world = result.world;
  }

  return Object.freeze({ before: batchStart, world, counters });
}

function expectedA2Cadence(
  mode: A2PublicationMode,
  before: CommittedWorld,
  after: CommittedWorld,
): A2CadenceCounters & { readonly worldRevisionDelta: number } {
  if (mode === 'legacy-per-commit') {
    return {
      authorityPublishCount: 5,
      worldRevisionDelta: 5,
      completePresentationCount: 5,
      fullStaticSyncCount: 5,
      externalNotifyCount: 5,
    };
  }
  return {
    authorityPublishCount: 5,
    worldRevisionDelta: 5,
    completePresentationCount: 1,
    fullStaticSyncCount: staticAuthorityChanged(before, after) ? 1 : 0,
    externalNotifyCount: 1,
  };
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

describe('temporal publication cadence contract', () => {
  it.each([
    ['legacy-per-commit', 'dynamic-only minute', worldAtMinute(8 * 60 + 58)],
    ['coalesced', 'dynamic-only minute', worldAtMinute(8 * 60 + 58)],
    ['legacy-per-commit', '08:59→09:00 Growth completion', worldAtGrowthCompletion()],
    ['coalesced', '08:59→09:00 Growth completion', worldAtGrowthCompletion()],
  ] as const)('%s / %s matches A2 cadence contract', (mode, _scenario, before) => {
    const actual = runPublicationCadence(before, mode);
    const expected = expectedA2Cadence(mode, actual.before, actual.world);

    expect({
      ...actual.counters,
      worldRevisionDelta: actual.world.revision - actual.before.revision,
    }).toEqual(expected);
  });

  it('does not publish any phase when a later transport quantum rejects', () => {
    const before = worldAtMinute(8 * 60 + 58);
    const counters: A2CadenceCounters = {
      authorityPublishCount: 0,
      completePresentationCount: 0,
      fullStaticSyncCount: 0,
      externalNotifyCount: 0,
    };
    const completePresentation = {
      synchronize() {
        counters.completePresentationCount += 1;
      },
      rebuildFromCommitted() {
        counters.completePresentationCount += 1;
      },
    };
    const coordinator = countingCoordinator(before, counters, completePresentation);
    let graphCalls = 0;
    const controller = createTemporalPublicationController({
      coordinator,
      registries: createFoundationRciRegistries(),
      graphForWorld: (world) => {
        graphCalls += 1;
        if (graphCalls === 2) throw new Error('test:q2-rejected');
        return emptyTrafficGraph(world);
      },
      reservedCells: () => Object.freeze([]),
      intermediatePresentation: completePresentation,
      finalDynamicPresentation: completePresentation,
      completePresentation,
      presentationSuppressed: () => false,
      adoptCommittedWorld: () => {
        counters.externalNotifyCount += 1;
      },
    });

    const result = controller.advanceTemporalMinute();

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.phase).toBe('quantum-2');
    expect(result.reason).toBe('traffic:planning-error');
    expect(result.beforeRevision).toBe(before.revision);
    expect(result.world.revision).toBe(before.revision);
    expect(result.world.simulation.absoluteGameMinute).toBe(before.simulation.absoluteGameMinute);
    expect(counters.authorityPublishCount).toBe(0);
    expect(counters.completePresentationCount).toBe(0);
    expect(counters.externalNotifyCount).toBe(0);
  });
});
