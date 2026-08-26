import type { RciDefinitionRegistries } from '@web-three-city/rci-core';
import type { TrafficGraph } from '@web-three-city/traffic-core';
import type { CellCoord } from '@web-three-city/world-core';
import type { CommittedWorld } from './application/committed-world.js';
import { staticPresentationNeedsRebuild } from './application/static-presentation-refresh.js';
import type {
  WorldPresentationPort,
  WorldPublication,
  WorldPublicationResult,
  WorldPublicationRejection,
  WorldTransactionCoordinator,
} from './application/world-transaction-coordinator.js';
import {
  commitGameMinuteTransaction,
  planGameMinuteTransaction,
} from './game-minute-transaction.js';
import {
  commitTrafficTransportTransaction,
  planTrafficTransportTransaction,
} from './traffic-transport-transaction.js';
import type { RoadTrafficSourceProjectionProvider } from './road-traffic-source-provider.js';
import type { TrafficModeGraphProvider } from './traffic-mode-graph-provider.js';

export interface TemporalPublicationControllerOptions {
  readonly coordinator: WorldTransactionCoordinator;
  readonly registries: RciDefinitionRegistries;
  readonly graphForWorld: (world: CommittedWorld) => TrafficGraph;
  readonly reservedCells: () => readonly CellCoord[];
  readonly intermediatePresentation: WorldPresentationPort;
  readonly finalDynamicPresentation: WorldPresentationPort;
  readonly completePresentation: WorldPresentationPort;
  readonly presentationSuppressed: () => boolean;
  readonly adoptCommittedWorld: (world: CommittedWorld) => void;
  readonly roadTrafficSourceProvider?: RoadTrafficSourceProjectionProvider;
  readonly trafficModeGraphProvider?: TrafficModeGraphProvider;
}

export type TemporalPhase = 'game-minute' | 'quantum-1' | 'quantum-2' | 'quantum-3' | 'quantum-4';
export type TemporalAdvanceFailureReason =
  WorldPublicationRejection | 'traffic:planning-error' | 'game-minute:invalid-plan';

export interface TemporalPhaseReceipt {
  readonly phase: TemporalPhase;
  readonly beforeRevision: number;
  readonly afterRevision: number;
}

export type TemporalAdvanceResult =
  | Readonly<{
      status: 'committed';
      beforeGameMinute: number;
      afterGameMinute: number;
      beforeRevision: number;
      afterRevision: number;
      phaseReceipts: readonly [
        TemporalPhaseReceipt,
        TemporalPhaseReceipt,
        TemporalPhaseReceipt,
        TemporalPhaseReceipt,
        TemporalPhaseReceipt,
      ];
      world: CommittedWorld;
    }>
  | Readonly<{
      status: 'rejected';
      phase: TemporalPhase;
      reason: TemporalAdvanceFailureReason;
      beforeGameMinute: number;
      beforeRevision: number;
      world: CommittedWorld;
    }>;

export interface TemporalPublicationController {
  advanceGameMinute(input?: Readonly<{ automaticGrowth?: boolean }>): CommittedWorld;
  advanceTransportQuantum(): CommittedWorld;
  advanceTemporalMinute(input?: Readonly<{ automaticGrowth?: boolean }>): TemporalAdvanceResult;
}

function rejectedWorld(coordinator: WorldTransactionCoordinator): CommittedWorld {
  return coordinator.snapshot();
}

function rejectedTemporal(
  before: CommittedWorld,
  coordinator: WorldTransactionCoordinator,
  phase: TemporalPhase,
  reason: TemporalAdvanceFailureReason,
): TemporalAdvanceResult {
  return Object.freeze({
    status: 'rejected' as const,
    phase,
    reason,
    beforeGameMinute: before.simulation.absoluteGameMinute,
    beforeRevision: before.revision,
    world: coordinator.snapshot(),
  });
}

function commitPresentation(
  options: TemporalPublicationControllerOptions,
): WorldPresentationPort | undefined {
  return options.presentationSuppressed() ? options.intermediatePresentation : undefined;
}

function commitGameMinute(
  options: TemporalPublicationControllerOptions,
  input: Readonly<{ automaticGrowth?: boolean }> | undefined,
  presentation: WorldPresentationPort | undefined,
  internalCommit: boolean,
): WorldPublicationResult {
  const current = options.coordinator.snapshotForTransaction();
  try {
    const plan = planGameMinuteTransaction({
      world: current,
      registries: options.registries,
      reservedCells: options.reservedCells(),
      ...(options.roadTrafficSourceProvider === undefined
        ? {}
        : { roadTrafficSourceProvider: options.roadTrafficSourceProvider }),
      ...(options.trafficModeGraphProvider === undefined
        ? {}
        : { trafficModeGraphProvider: options.trafficModeGraphProvider }),
      ...(input?.automaticGrowth === undefined ? {} : { automaticGrowth: input.automaticGrowth }),
    });
    if (!plan.valid)
      return {
        status: 'rejected',
        world: rejectedWorld(options.coordinator),
        reason: 'world:invalid-candidate',
      };
    return commitGameMinuteTransaction(options.coordinator, plan, presentation, internalCommit);
  } catch {
    return {
      status: 'rejected',
      world: rejectedWorld(options.coordinator),
      reason: 'world:invalid-candidate',
    };
  }
}

function commitTransportQuantum(
  options: TemporalPublicationControllerOptions,
  presentation: WorldPresentationPort | undefined,
  internalCommit: boolean,
): WorldPublicationResult {
  const current = options.coordinator.snapshotForTransaction();
  const traffic = current.traffic as unknown as { readonly schemaVersion: number };
  if (traffic.schemaVersion !== 2) {
    return {
      status: 'rejected',
      world: rejectedWorld(options.coordinator),
      reason: 'world:invalid-candidate',
    };
  }
  try {
    const graph = options.graphForWorld(current);
    const plan = planTrafficTransportTransaction({
      world: current,
      mobility: current.mobility,
      traffic: current.traffic as never,
      graph,
    });
    return commitTrafficTransportTransaction(
      options.coordinator,
      plan,
      presentation,
      internalCommit,
    );
  } catch {
    return {
      status: 'rejected',
      world: rejectedWorld(options.coordinator),
      reason: 'world:invalid-candidate',
    };
  }
}

function synchronizeFinalPresentation(
  options: TemporalPublicationControllerOptions,
  before: CommittedWorld,
  finalWorld: CommittedWorld,
): void {
  const presentation = options.presentationSuppressed()
    ? options.intermediatePresentation
    : staticPresentationNeedsRebuild(before, finalWorld)
      ? options.completePresentation
      : options.finalDynamicPresentation;
  try {
    presentation.synchronize(finalWorld);
  } catch {
    try {
      presentation.rebuildFromCommitted(finalWorld);
    } catch {
      // Authority remains committed; the next explicit rebuild can recover presentation.
    }
  }
}

export function createTemporalPublicationController(
  options: TemporalPublicationControllerOptions,
): TemporalPublicationController {
  const advanceGameMinute = (
    input: Readonly<{ automaticGrowth?: boolean }> = {},
  ): CommittedWorld => {
    const publication = commitGameMinute(
      options,
      input,
      commitPresentation(options),
      options.presentationSuppressed(),
    );
    if (publication.status !== 'committed') return rejectedWorld(options.coordinator);
    options.adoptCommittedWorld(publication.world);
    return publication.world;
  };

  const advanceTransportQuantum = (): CommittedWorld => {
    const publication = commitTransportQuantum(
      options,
      commitPresentation(options),
      options.presentationSuppressed(),
    );
    if (publication.status !== 'committed') return rejectedWorld(options.coordinator);
    options.adoptCommittedWorld(publication.world);
    return publication.world;
  };

  const advanceTemporalMinute = (
    input: Readonly<{ automaticGrowth?: boolean }> = {},
  ): TemporalAdvanceResult => {
    const before = options.coordinator.snapshotForTransaction();
    const intermediatePresentation = options.intermediatePresentation;
    let minutePlan: ReturnType<typeof planGameMinuteTransaction>;
    try {
      minutePlan = planGameMinuteTransaction({
        world: before,
        registries: options.registries,
        reservedCells: options.reservedCells(),
        ...(options.roadTrafficSourceProvider === undefined
          ? {}
          : { roadTrafficSourceProvider: options.roadTrafficSourceProvider }),
        ...(options.trafficModeGraphProvider === undefined
          ? {}
          : { trafficModeGraphProvider: options.trafficModeGraphProvider }),
        ...(input.automaticGrowth === undefined ? {} : { automaticGrowth: input.automaticGrowth }),
      });
    } catch {
      return rejectedTemporal(
        before,
        options.coordinator,
        'game-minute',
        'game-minute:invalid-plan',
      );
    }
    if (!minutePlan.valid) {
      return rejectedTemporal(
        before,
        options.coordinator,
        'game-minute',
        'game-minute:invalid-plan',
      );
    }
    const publications: WorldPublication[] = [
      {
        baseRevision: minutePlan.baseWorldRevision,
        baseFingerprint: minutePlan.baseFingerprint,
        nextWorld: minutePlan.nextWorld,
        nextFingerprint: minutePlan.nextFingerprint,
        presentation: intermediatePresentation,
      },
    ];
    let current = minutePlan.nextWorld;
    for (let quantum = 0; quantum < 4; quantum += 1) {
      const traffic = current.traffic as unknown as { readonly schemaVersion: number };
      if (traffic.schemaVersion !== 2) {
        return rejectedTemporal(
          before,
          options.coordinator,
          `quantum-${quantum + 1}` as TemporalPhase,
          'world:invalid-candidate',
        );
      }
      let transportPlan;
      try {
        transportPlan = planTrafficTransportTransaction({
          world: current,
          mobility: current.mobility,
          traffic: current.traffic as never,
          graph: options.graphForWorld(current),
        });
      } catch {
        return rejectedTemporal(
          before,
          options.coordinator,
          `quantum-${quantum + 1}` as TemporalPhase,
          'traffic:planning-error',
        );
      }
      publications.push({
        baseRevision: transportPlan.baseWorldRevision,
        baseFingerprint: transportPlan.baseFingerprint,
        nextWorld: transportPlan.nextWorld,
        nextFingerprint: transportPlan.nextFingerprint,
        presentation: intermediatePresentation,
      });
      current = transportPlan.nextWorld;
    }
    const batch = options.coordinator.publishBatchForTransaction(publications);
    if (batch.status !== 'committed') {
      return rejectedTemporal(before, options.coordinator, 'quantum-4', batch.reason);
    }
    const finalWorld = batch.world;
    synchronizeFinalPresentation(options, before, finalWorld);
    const externallyVisibleFinal = options.coordinator.snapshot();
    options.adoptCommittedWorld(externallyVisibleFinal);
    const phases: readonly TemporalPhase[] = [
      'game-minute',
      'quantum-1',
      'quantum-2',
      'quantum-3',
      'quantum-4',
    ];
    const phaseReceipts = publications.map((publication, index) => ({
      phase: phases[index]!,
      beforeRevision: publication.baseRevision,
      afterRevision: publication.nextWorld.revision,
    })) as [
      TemporalPhaseReceipt,
      TemporalPhaseReceipt,
      TemporalPhaseReceipt,
      TemporalPhaseReceipt,
      TemporalPhaseReceipt,
    ];
    return Object.freeze({
      status: 'committed' as const,
      beforeGameMinute: before.simulation.absoluteGameMinute,
      afterGameMinute: externallyVisibleFinal.simulation.absoluteGameMinute,
      beforeRevision: before.revision,
      afterRevision: externallyVisibleFinal.revision,
      phaseReceipts: Object.freeze(phaseReceipts),
      world: externallyVisibleFinal,
    });
  };

  return Object.freeze({
    advanceGameMinute,
    advanceTransportQuantum,
    advanceTemporalMinute,
  });
}
