import { settleMobilityTrip, type MobilitySnapshotV1 } from '@web-three-city/citizen-mobility-core';
import {
  advanceTrafficQuantum,
  createTrafficSnapshotV2,
  type TrafficGraph,
  type TrafficSnapshotV1,
  type TrafficSnapshotV2,
} from '@web-three-city/traffic-core';
import type { CommittedWorld } from './application/committed-world.js';
import { memoizedFingerprintCommittedWorld } from './application/committed-world-fingerprint.js';
import type {
  WorldPresentationPort,
  WorldPublicationResult,
  WorldTransactionCoordinator,
} from './application/world-transaction-coordinator.js';

export interface TrafficTransportTransactionPlan {
  readonly baseWorldRevision: number;
  readonly baseFingerprint: string;
  readonly nextWorld: CommittedWorld;
  readonly nextFingerprint: string;
}

/** Publishes one authoritative V2 Traffic quantum with linked Mobility settlement. */
export function planTrafficTransportTransaction(
  input: Readonly<{
    world: CommittedWorld;
    mobility: MobilitySnapshotV1;
    traffic: TrafficSnapshotV1 | TrafficSnapshotV2;
    graph?: TrafficGraph;
  }>,
): TrafficTransportTransactionPlan {
  const advanced =
    input.traffic.schemaVersion === 2
      ? advanceTrafficQuantum({
          snapshot: input.traffic,
          graph:
            input.graph ??
            (() => {
              throw new Error('traffic-transport-transaction:missing-graph');
            })(),
        }).snapshot
      : input.traffic;
  let mobility = input.mobility;
  let mobilitySettlementFailed = false;
  let removedTerminalTrip = false;
  const activeTrips = advanced.activeTrips.filter((trip) => {
    if (trip.status === 'Active') return true;
    removedTerminalTrip = true;
    try {
      mobility = settleMobilityTrip({
        snapshot: mobility,
        tripId: trip.tripId,
        outcome:
          trip.status === 'Arrived'
            ? 'Arrived'
            : trip.status === 'Cancelled'
              ? 'Cancelled'
              : 'Failed',
      });
    } catch {
      mobilitySettlementFailed = true;
    }
    return false;
  });
  const traffic =
    advanced.schemaVersion === 2 && removedTerminalTrip
      ? createTrafficSnapshotV2({
          ...advanced,
          activeTrips: activeTrips as TrafficSnapshotV2['activeTrips'],
        })
      : advanced;
  // Keep the incomplete Mobility state in the staged candidate. The world coordinator then
  // rejects it as an invalid cross-domain publication, leaving the prior world untouched.
  if (mobilitySettlementFailed) mobility = input.mobility;
  const nextWorld = Object.freeze({
    ...input.world,
    revision: input.world.revision + 1,
    mobility,
    traffic,
  }) as CommittedWorld;
  const baseFingerprint = memoizedFingerprintCommittedWorld(input.world);
  const nextFingerprint = memoizedFingerprintCommittedWorld(nextWorld);
  return Object.freeze({
    baseWorldRevision: input.world.revision,
    baseFingerprint,
    nextWorld,
    nextFingerprint,
  });
}

export function commitTrafficTransportTransaction(
  coordinator: WorldTransactionCoordinator,
  plan: TrafficTransportTransactionPlan,
  presentation?: WorldPresentationPort,
  internalCommit = false,
): WorldPublicationResult {
  const publication = {
    baseRevision: plan.baseWorldRevision,
    baseFingerprint: plan.baseFingerprint,
    nextWorld: plan.nextWorld,
    nextFingerprint: plan.nextFingerprint,
    ...(presentation === undefined ? {} : { presentation }),
  };
  return internalCommit
    ? coordinator.publishForTransaction(publication)
    : coordinator.publish(publication);
}
