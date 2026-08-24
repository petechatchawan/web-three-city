import type { RciDefinitionRegistries } from '@web-three-city/rci-core';
import type { TrafficGraph } from '@web-three-city/traffic-core';
import type { CellCoord } from '@web-three-city/world-core';
import type { CommittedWorld } from './application/committed-world.js';
import { staticPresentationNeedsRebuild } from './application/static-presentation-refresh.js';
import type {
  WorldPresentationPort,
  WorldPublicationResult,
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
}

export interface TemporalPublicationController {
  advanceGameMinute(input?: Readonly<{ automaticGrowth?: boolean }>): CommittedWorld;
  advanceTransportQuantum(): CommittedWorld;
  advanceTemporalMinute(input?: Readonly<{ automaticGrowth?: boolean }>): CommittedWorld;
}

function rejectedWorld(coordinator: WorldTransactionCoordinator): CommittedWorld {
  return coordinator.snapshot();
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
    const plan = planTrafficTransportTransaction({
      world: current,
      mobility: current.mobility,
      traffic: current.traffic as never,
      graph: options.graphForWorld(current),
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
  ): CommittedWorld => {
    const before = options.coordinator.snapshotForTransaction();
    const intermediatePresentation = options.intermediatePresentation;
    const minute = commitGameMinute(options, input, intermediatePresentation, true);
    if (minute.status !== 'committed') return rejectedWorld(options.coordinator);
    for (let quantum = 0; quantum < 4; quantum += 1) {
      const transport = commitTransportQuantum(options, intermediatePresentation, true);
      if (transport.status !== 'committed') return rejectedWorld(options.coordinator);
    }
    const finalWorld = options.coordinator.snapshotForTransaction();
    synchronizeFinalPresentation(options, before, finalWorld);
    const externallyVisibleFinal = options.coordinator.snapshot();
    options.adoptCommittedWorld(externallyVisibleFinal);
    return externallyVisibleFinal;
  };

  return Object.freeze({
    advanceGameMinute,
    advanceTransportQuantum,
    advanceTemporalMinute,
  });
}
