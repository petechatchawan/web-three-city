import {
  TRAFFIC_PROGRESS_MAX_Q,
  compareTrafficId,
  type ActiveTransportTripV2,
  type IntersectionMovementKind,
  type TrafficGraph,
} from './contracts.js';
import { TrafficContractError } from './errors.js';
import {
  arriveLeavingDrive,
  beginDriveLeaving,
  beginDriveTravelling,
  enterDriveMovementPhase,
} from './drive-lifecycle.js';
import { createTrafficSnapshotV2, type TrafficSnapshotV2 } from './traffic-snapshot.js';
import { advanceTrafficTimeCursor } from './transport-time.js';
import { canonicalHeadwayCapProgressQ, createLaneOccupancyIndex } from './lane-occupancy.js';
import { TrafficGraphMetadataCache, type TrafficGraphMetadata } from './traffic-graph-metadata.js';
import {
  arbitrateIntersectionMovements,
  type IntersectionArbitrationCandidate,
} from './intersection-arbitration.js';
import { type TrafficScaleInstrumentation } from './traffic-scale-instrumentation.js';
import {
  accrueStaticAccessServiceCredit,
  acquireTrafficReservationBundle,
  createEntryReservationResourceIds,
  createTrafficReservationLedgerFromTrips,
  releaseTrafficReservationBundle,
  type TrafficReservationLedger,
} from './traffic-reservation.js';

const NODE_TRAVERSAL_REAR_CLEARANCE_PROGRESS_Q = 125_000;
const defaultTrafficGraphMetadataCache = new TrafficGraphMetadataCache();

export interface TrafficQuantumReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly elapsedTransportSeconds: 1;
  readonly arrivedTripIds: readonly string[];
  readonly newlyQueuedTripIds: readonly string[];
  readonly releasedTripIds: readonly string[];
}

function movementKindFor(
  incomingEdgeId: string,
  outgoingEdgeId: string,
  metadata: TrafficGraphMetadata,
): IntersectionMovementKind {
  const directions: readonly ('N' | 'E' | 'S' | 'W')[] = ['N', 'E', 'S', 'W'];
  const directionForMetadataEdge = (edgeId: string): 'N' | 'E' | 'S' | 'W' => {
    const edge = metadata.edgeById.get(edgeId)!;
    const from = metadata.nodeById.get(edge.fromNodeId)!;
    const to = metadata.nodeById.get(edge.toNodeId)!;
    const dx = to.xQ - from.xQ;
    const dz = to.zQ - from.zQ;
    if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 'E' : 'W';
    return dz >= 0 ? 'S' : 'N';
  };
  const incoming = directionForMetadataEdge(incomingEdgeId);
  const outgoing = directionForMetadataEdge(outgoingEdgeId);
  const turn = (directions.indexOf(outgoing) - directions.indexOf(incoming) + 4) % 4;
  return turn === 2 ? 'Straight' : turn === 1 ? 'Left' : 'Right';
}

function arbitrationCandidateFor(
  trip: ActiveTransportTripV2,
  metadata: TrafficGraphMetadata,
): IntersectionArbitrationCandidate | null {
  if (trip.mode !== 'Drive' || trip.queuedMovement === null) return null;
  const nodeId = metadata.edgeById.get(trip.queuedMovement.fromEdgeId)?.toNodeId;
  if (nodeId === undefined) return null;
  const classification = metadata.driveNodeClassificationByNodeId.get(nodeId)?.classification;
  if (classification !== 'Merge' && classification !== 'ConflictJunction') return null;
  const resourceIds =
    classification === 'Merge'
      ? [`MergeAdmission:${nodeId}`, `ReceivingAdmission:${trip.queuedMovement.toEdgeId}`]
      : [
          `IntersectionConflictZone:${nodeId}:center`,
          `ReceivingAdmission:${trip.queuedMovement.toEdgeId}`,
        ];
  return Object.freeze({
    tripId: trip.tripId,
    nodeId,
    traversalClass: classification,
    incomingEdgeId: trip.queuedMovement.fromEdgeId,
    outgoingEdgeId: trip.queuedMovement.toEdgeId,
    ...(classification === 'ConflictJunction'
      ? {
          movementKind: movementKindFor(
            trip.queuedMovement.fromEdgeId,
            trip.queuedMovement.toEdgeId,
            metadata,
          ),
        }
      : {}),
    queuedAtTransportSecond: trip.queuedMovement.arrivedAtTransportSecond,
    lanePositionQ: trip.progressQ,
    resourceIds: Object.freeze(
      resourceIds.sort((first, second) => first.localeCompare(second, 'en')),
    ),
  });
}

type QuantumAdvanceResult = Readonly<{
  trip: ActiveTransportTripV2;
  arrived: boolean;
  newlyQueued: boolean;
  reservations: TrafficReservationLedger;
}>;

function advanceActiveNodeTraversal(
  trip: ActiveTransportTripV2,
  reservations: TrafficReservationLedger,
): QuantumAdvanceResult | null {
  if (trip.mode !== 'Drive' || trip.activeNodeTraversal === undefined) return null;
  const traversal = trip.activeNodeTraversal;
  const progressQ = Math.min(TRAFFIC_PROGRESS_MAX_Q, traversal.progressQ + 250_000);
  if (progressQ < NODE_TRAVERSAL_REAR_CLEARANCE_PROGRESS_Q) {
    return Object.freeze({
      trip: Object.freeze({
        ...trip,
        activeNodeTraversal: Object.freeze({ ...traversal, progressQ }),
      }),
      arrived: false,
      newlyQueued: false,
      reservations,
    });
  }
  const { activeNodeTraversal, ...tripWithoutTraversal } = trip;
  return Object.freeze({
    trip: Object.freeze({
      ...tripWithoutTraversal,
      segmentIndex: trip.segmentIndex + 1,
      progressQ: 0,
      lastStableNodeId: activeNodeTraversal.nodeId,
    }),
    arrived: false,
    newlyQueued: false,
    reservations: releaseTrafficReservationBundle({
      ledger: reservations,
      tripId: trip.tripId,
      resourceIds: activeNodeTraversal.reservedResourceIds,
    }),
  });
}

function advanceDrivePhase(
  trip: ActiveTransportTripV2,
  entryAdmission: Readonly<{
    accessServiceRatePerTransportSecond: number;
    ingressRearClearanceProgressQ: number;
  }>,
  reservations: TrafficReservationLedger,
  receivingEdgesOccupiedAtEntry: ReadonlySet<string>,
): QuantumAdvanceResult | null {
  if (trip.mode !== 'Drive') return null;
  if (trip.driveMovementPhase === 'WaitingForEntry') {
    const entryServiceCredit = accrueStaticAccessServiceCredit({
      currentCredit: trip.entryServiceCredit ?? 0,
      elapsedTransportSeconds: 1,
      accessServiceRatePerTransportSecond: entryAdmission.accessServiceRatePerTransportSecond,
      congestionMilli: 0,
      loadMilli: 0,
      queueLength: 0,
    });
    const firstEdgeId = trip.routeEdgeIds[0];
    if (
      entryServiceCredit < 1 ||
      firstEdgeId === undefined ||
      receivingEdgesOccupiedAtEntry.has(firstEdgeId)
    ) {
      return Object.freeze({
        trip: Object.freeze({ ...trip, entryServiceCredit }),
        arrived: false,
        newlyQueued: false,
        reservations,
      });
    }
    const resourceIds = createEntryReservationResourceIds({
      originBuildingId: trip.originBuildingId,
      firstEdgeId,
    });
    const acquired = acquireTrafficReservationBundle({
      ledger: reservations,
      tripId: trip.tripId,
      resourceIds,
    });
    if (!acquired.granted) {
      return Object.freeze({
        trip: Object.freeze({ ...trip, entryServiceCredit }),
        arrived: false,
        newlyQueued: false,
        reservations,
      });
    }
    return Object.freeze({
      trip: Object.freeze({
        ...enterDriveMovementPhase(trip),
        entryServiceCredit: entryServiceCredit - 1,
        entryReservationResourceIds: resourceIds,
      }),
      arrived: false,
      newlyQueued: false,
      reservations: acquired.ledger,
    });
  }
  if (trip.driveMovementPhase === 'Entering') {
    return Object.freeze({
      trip: beginDriveTravelling(trip),
      arrived: false,
      newlyQueued: false,
      reservations,
    });
  }
  if (trip.driveMovementPhase === 'Leaving') {
    return Object.freeze({
      trip: arriveLeavingDrive(trip),
      arrived: true,
      newlyQueued: false,
      reservations: releaseTrafficReservationBundle({
        ledger: reservations,
        tripId: trip.tripId,
        resourceIds: trip.entryReservationResourceIds ?? [],
      }),
    });
  }
  return null;
}

function advanceRouteSegment(
  trip: ActiveTransportTripV2,
  graph: TrafficGraph,
  metadata: TrafficGraphMetadata,
  arrivedAtTransportSecond: number,
  scaleInstrumentation: TrafficScaleInstrumentation | undefined,
  occupancy: ReturnType<typeof createLaneOccupancyIndex>,
  entryAdmission: Readonly<{
    ingressRearClearanceProgressQ: number;
  }>,
  reservations: TrafficReservationLedger,
): QuantumAdvanceResult {
  const edgeId = trip.routeEdgeIds[trip.segmentIndex];
  if (edgeId === undefined) throw new TrafficContractError('traffic:invalid-trip');
  const edge = metadata.edgeById.get(edgeId);
  if (edge === undefined || edge.mode !== trip.mode) {
    throw new TrafficContractError('traffic:invalid-trip');
  }
  const remainingQ = TRAFFIC_PROGRESS_MAX_Q - trip.progressQ;
  const secondsToFinish = Math.max(
    1,
    Math.ceil((edge.freeFlowTravelSeconds * remainingQ) / TRAFFIC_PROGRESS_MAX_Q),
  );
  if (secondsToFinish > 1) {
    const progressAdded = Math.floor(TRAFFIC_PROGRESS_MAX_Q / edge.freeFlowTravelSeconds);
    const proposedProgressQ = Math.min(
      TRAFFIC_PROGRESS_MAX_Q - 1,
      trip.progressQ + Math.max(1, progressAdded),
    );
    const nextTrip = Object.freeze({
      ...trip,
      progressQ: canonicalHeadwayCapProgressQ({
        trip,
        proposedProgressQ,
        graph,
        occupancy,
        ...(scaleInstrumentation === undefined ? {} : { scaleInstrumentation }),
      }),
    });
    const released =
      nextTrip.mode === 'Drive' &&
      nextTrip.entryReservationResourceIds !== undefined &&
      nextTrip.entryReservationResourceIds.length > 0 &&
      nextTrip.progressQ >= entryAdmission.ingressRearClearanceProgressQ;
    return Object.freeze({
      trip: released
        ? Object.freeze({ ...nextTrip, entryReservationResourceIds: Object.freeze([]) })
        : nextTrip,
      arrived: false,
      newlyQueued: false,
      reservations: released
        ? releaseTrafficReservationBundle({
            ledger: reservations,
            tripId: trip.tripId,
            resourceIds: trip.entryReservationResourceIds!,
          })
        : reservations,
    });
  }

  const nextIndex = trip.segmentIndex + 1;
  if (nextIndex >= trip.routeEdgeIds.length) {
    if (trip.mode === 'Drive') {
      return Object.freeze({
        trip: beginDriveLeaving(
          Object.freeze({
            ...trip,
            progressQ: TRAFFIC_PROGRESS_MAX_Q,
            lastStableNodeId: edge.toNodeId,
            queuedMovement: null,
          }),
        ),
        arrived: false,
        newlyQueued: false,
        reservations,
      });
    }
    return Object.freeze({
      trip: Object.freeze({
        ...trip,
        progressQ: TRAFFIC_PROGRESS_MAX_Q,
        lastStableNodeId: edge.toNodeId,
        queuedMovement: null,
        status: 'Arrived' as const,
        failureReason: null,
      }),
      arrived: true,
      newlyQueued: false,
      reservations,
    });
  }

  const nextEdgeId = trip.routeEdgeIds[nextIndex]!;
  const nextEdge = metadata.edgeById.get(nextEdgeId);
  if (
    nextEdge === undefined ||
    nextEdge.fromNodeId !== edge.toNodeId ||
    nextEdge.mode !== trip.mode
  ) {
    throw new TrafficContractError('traffic:invalid-trip');
  }
  const nodeClassification =
    trip.mode === 'Drive'
      ? (metadata.driveNodeClassificationByNodeId.get(edge.toNodeId) ?? null)
      : null;
  if (
    trip.mode === 'Drive' &&
    (nodeClassification?.classification === 'Merge' ||
      nodeClassification?.classification === 'ConflictJunction')
  ) {
    return Object.freeze({
      trip: Object.freeze({
        ...trip,
        progressQ: TRAFFIC_PROGRESS_MAX_Q,
        lastStableNodeId: edge.toNodeId,
        queuedMovement: Object.freeze({
          fromEdgeId: edge.edgeId,
          toEdgeId: nextEdge.edgeId,
          arrivedAtTransportSecond,
        }),
      }),
      arrived: false,
      newlyQueued: true,
      reservations,
    });
  }
  return Object.freeze({
    trip: Object.freeze({
      ...trip,
      segmentIndex: nextIndex,
      progressQ: 0,
      lastStableNodeId: edge.toNodeId,
    }),
    arrived: false,
    newlyQueued: false,
    reservations,
  });
}

function advanceOneQuantum(
  trip: ActiveTransportTripV2,
  graph: TrafficGraph,
  metadata: TrafficGraphMetadata,
  arrivedAtTransportSecond: number,
  scaleInstrumentation: TrafficScaleInstrumentation | undefined,
  occupancy = createLaneOccupancyIndex({ graph, trips: [trip] }),
  entryAdmission: Readonly<{
    accessServiceRatePerTransportSecond: number;
    ingressRearClearanceProgressQ: number;
  }>,
  reservations: TrafficReservationLedger,
  receivingEdgesOccupiedAtEntry: ReadonlySet<string>,
): QuantumAdvanceResult {
  if (trip.status !== 'Active' || trip.queuedMovement !== null) {
    return Object.freeze({ trip, arrived: false, newlyQueued: false, reservations });
  }
  const traversal = advanceActiveNodeTraversal(trip, reservations);
  if (traversal !== null) return traversal;
  const drivePhase = advanceDrivePhase(
    trip,
    entryAdmission,
    reservations,
    receivingEdgesOccupiedAtEntry,
  );
  if (drivePhase !== null) return drivePhase;
  return advanceRouteSegment(
    trip,
    graph,
    metadata,
    arrivedAtTransportSecond,
    scaleInstrumentation,
    occupancy,
    entryAdmission,
    reservations,
  );
}

export function advanceTrafficQuantum(
  input: Readonly<{
    snapshot: TrafficSnapshotV2;
    graph: TrafficGraph;
    entryAdmission?: Readonly<{
      accessServiceRatePerTransportSecond?: number;
      ingressRearClearanceProgressQ?: number;
    }>;
    scaleInstrumentation?: TrafficScaleInstrumentation;
    graphMetadataCache?: TrafficGraphMetadataCache;
  }>,
): Readonly<{ snapshot: TrafficSnapshotV2; receipt: TrafficQuantumReceipt }> {
  const snapshot = createTrafficSnapshotV2(input.snapshot);
  const timeCursor = advanceTrafficTimeCursor(snapshot.timeCursor);
  if (snapshot.activeTrips.length === 0) {
    const next = createTrafficSnapshotV2({
      ...snapshot,
      revision: snapshot.revision + 1,
      timeCursor,
    });
    return Object.freeze({
      snapshot: next,
      receipt: Object.freeze({
        beforeRevision: snapshot.revision,
        afterRevision: next.revision,
        elapsedTransportSeconds: 1,
        arrivedTripIds: Object.freeze([]),
        newlyQueuedTripIds: Object.freeze([]),
        releasedTripIds: Object.freeze([]),
      }),
    });
  }
  const arrived: string[] = [];
  const newlyQueued: string[] = [];
  const released: string[] = [];
  const metadata = (input.graphMetadataCache ?? defaultTrafficGraphMetadataCache).getOrCreate(
    input.graph,
    input.scaleInstrumentation,
  );
  const occupancy = createLaneOccupancyIndex({
    graph: input.graph,
    trips: snapshot.activeTrips,
    ...(input.scaleInstrumentation === undefined
      ? {}
      : { scaleInstrumentation: input.scaleInstrumentation }),
  });
  const entryAdmission = Object.freeze({
    accessServiceRatePerTransportSecond:
      input.entryAdmission?.accessServiceRatePerTransportSecond ?? 1,
    ingressRearClearanceProgressQ: input.entryAdmission?.ingressRearClearanceProgressQ ?? 125_000,
  });
  const receivingEdgesOccupiedAtEntry = new Set<string>();
  for (const trip of snapshot.activeTrips) {
    if (
      trip.mode !== 'Drive' ||
      trip.status !== 'Active' ||
      trip.driveMovementPhase === 'WaitingForEntry'
    ) {
      continue;
    }
    const edgeId = trip.routeEdgeIds[trip.segmentIndex];
    if (edgeId !== undefined && trip.progressQ < entryAdmission.ingressRearClearanceProgressQ) {
      receivingEdgesOccupiedAtEntry.add(edgeId);
    }
  }
  let reservations = createTrafficReservationLedgerFromTrips(snapshot.activeTrips);
  const candidates = snapshot.activeTrips
    .map((trip) => arbitrationCandidateFor(trip, metadata))
    .filter((candidate): candidate is IntersectionArbitrationCandidate => candidate !== null);
  const arbitration = arbitrateIntersectionMovements({
    candidates,
    ledger: reservations,
    currentTransportSecond: timeCursor.absoluteTransportSecond,
    ...(input.scaleInstrumentation === undefined
      ? {}
      : { scaleInstrumentation: input.scaleInstrumentation }),
  });
  reservations = arbitration.ledger;
  const candidateByTripId = new Map(
    candidates.map((candidate) => [candidate.tripId, candidate] as const),
  );
  const grantedTripIds = new Set(arbitration.grantedTripIds);
  const activeTrips = snapshot.activeTrips.map((originalTrip) => {
    const candidate = candidateByTripId.get(originalTrip.tripId);
    const trip =
      candidate !== undefined && grantedTripIds.has(originalTrip.tripId)
        ? Object.freeze({
            ...originalTrip,
            queuedMovement: null,
            activeNodeTraversal: Object.freeze({
              nodeId: candidate.nodeId,
              traversalClass: candidate.traversalClass,
              incomingEdgeId: candidate.incomingEdgeId,
              outgoingEdgeId: candidate.outgoingEdgeId,
              ...(candidate.movementKind === undefined
                ? {}
                : { movementKind: candidate.movementKind }),
              reservedResourceIds: candidate.resourceIds,
              progressQ: 0,
            }),
          })
        : originalTrip;
    if (candidate !== undefined && grantedTripIds.has(originalTrip.tripId)) return trip;
    const result = advanceOneQuantum(
      trip,
      input.graph,
      metadata,
      timeCursor.absoluteTransportSecond,
      input.scaleInstrumentation,
      occupancy,
      entryAdmission,
      reservations,
      receivingEdgesOccupiedAtEntry,
    );
    reservations = result.reservations;
    if (result.arrived) arrived.push(trip.tripId);
    if (result.newlyQueued) newlyQueued.push(trip.tripId);
    if (
      (trip.entryReservationResourceIds?.length ?? 0) > 0 &&
      (result.trip.entryReservationResourceIds?.length ?? 0) === 0
    ) {
      released.push(trip.tripId);
    }
    return result.trip;
  });
  arrived.sort(compareTrafficId);
  newlyQueued.sort(compareTrafficId);
  released.sort(compareTrafficId);
  const next = createTrafficSnapshotV2({
    ...snapshot,
    revision: snapshot.revision + 1,
    timeCursor,
    activeTrips,
  });
  return Object.freeze({
    snapshot: next,
    receipt: Object.freeze({
      beforeRevision: snapshot.revision,
      afterRevision: next.revision,
      elapsedTransportSeconds: 1,
      arrivedTripIds: Object.freeze(arrived),
      newlyQueuedTripIds: Object.freeze(newlyQueued),
      releasedTripIds: Object.freeze(released),
    }),
  });
}
