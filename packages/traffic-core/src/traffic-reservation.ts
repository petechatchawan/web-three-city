import { type ActiveTransportTripV2, type TrafficGraph } from './contracts.js';
import { createTrafficSnapshotV2, type TrafficSnapshotV2 } from './traffic-snapshot.js';

export interface StaticAccessServiceCreditInput {
  readonly currentCredit: number;
  readonly elapsedTransportSeconds: number;
  readonly accessServiceRatePerTransportSecond: number;
  readonly congestionMilli: number;
  readonly loadMilli: number;
  readonly queueLength: number;
}

export type TrafficReservationResourceKind =
  'IngressFootprint' | 'ReceivingAdmission' | 'MergeAdmission' | 'IntersectionConflictZone';

export interface TrafficReservationLedger {
  readonly ownersByResource: ReadonlyMap<string, string>;
}

export interface TrafficReservationBundleResult {
  readonly granted: boolean;
  readonly ledger: TrafficReservationLedger;
}

export function createTrafficReservationResourceId(
  kind: TrafficReservationResourceKind,
  subjectId: string,
): string {
  if (typeof subjectId !== 'string' || subjectId.length === 0 || subjectId.trim().length === 0) {
    throw new RangeError('traffic:invalid-reservation-resource');
  }
  return `${kind}:${subjectId}`;
}

export function createTrafficReservationLedger(
  ownersByResource: ReadonlyMap<string, string> = new Map(),
): TrafficReservationLedger {
  const entries = [...ownersByResource.entries()].sort(([first], [second]) =>
    first.localeCompare(second, 'en'),
  );
  return Object.freeze({ ownersByResource: new Map(entries) });
}

export function createTrafficReservationLedgerFromTrips(
  trips: readonly ActiveTransportTripV2[],
): TrafficReservationLedger {
  const owners = new Map<string, string>();
  for (const trip of trips) {
    if (trip.status !== 'Active') continue;
    for (const resourceId of trip.entryReservationResourceIds ?? []) {
      const owner = owners.get(resourceId);
      if (owner !== undefined && owner !== trip.tripId) {
        throw new RangeError('traffic:duplicate-reservation-owner');
      }
      owners.set(resourceId, trip.tripId);
    }
    for (const resourceId of trip.activeNodeTraversal?.reservedResourceIds ?? []) {
      const owner = owners.get(resourceId);
      if (owner !== undefined && owner !== trip.tripId) {
        throw new RangeError('traffic:duplicate-reservation-owner');
      }
      owners.set(resourceId, trip.tripId);
    }
  }
  return createTrafficReservationLedger(owners);
}

export function trafficReservationOwnersByResource(
  ledger: TrafficReservationLedger,
): ReadonlyMap<string, string> {
  return ledger.ownersByResource;
}

export function acquireTrafficReservationBundle(
  input: Readonly<{
    ledger: TrafficReservationLedger;
    tripId: string;
    resourceIds: readonly string[];
  }>,
): TrafficReservationBundleResult {
  if (
    typeof input.tripId !== 'string' ||
    input.tripId.length === 0 ||
    input.tripId.trim().length === 0
  ) {
    throw new RangeError('traffic:invalid-reservation-owner');
  }
  const resourceIds = [...new Set(input.resourceIds)].sort((first, second) =>
    first.localeCompare(second, 'en'),
  );
  if (resourceIds.length === 0 || resourceIds.some((resourceId) => resourceId.length === 0)) {
    throw new RangeError('traffic:invalid-reservation-resource');
  }
  if (resourceIds.some((resourceId) => input.ledger.ownersByResource.has(resourceId))) {
    return Object.freeze({ granted: false, ledger: input.ledger });
  }
  const owners = new Map(input.ledger.ownersByResource);
  for (const resourceId of resourceIds) owners.set(resourceId, input.tripId);
  return Object.freeze({ granted: true, ledger: createTrafficReservationLedger(owners) });
}

export function releaseTrafficReservationBundle(
  input: Readonly<{
    ledger: TrafficReservationLedger;
    tripId: string;
    resourceIds: readonly string[];
  }>,
): TrafficReservationLedger {
  const owners = new Map(input.ledger.ownersByResource);
  for (const resourceId of input.resourceIds) {
    if (owners.get(resourceId) === input.tripId) owners.delete(resourceId);
  }
  return createTrafficReservationLedger(owners);
}

export function createEntryReservationResourceIds(
  input: Readonly<{
    originBuildingId: string;
    firstEdgeId: string;
  }>,
): readonly string[] {
  return Object.freeze(
    [
      createTrafficReservationResourceId('IngressFootprint', input.originBuildingId),
      createTrafficReservationResourceId('ReceivingAdmission', input.firstEdgeId),
    ].sort((first, second) => first.localeCompare(second, 'en')),
  );
}

/**
 * Access service is a static policy.  Live traffic facts are deliberately
 * accepted at this boundary so callers cannot accidentally fold them into the
 * accrual calculation.
 */
export function accrueStaticAccessServiceCredit(input: StaticAccessServiceCreditInput): number {
  if (
    !Number.isSafeInteger(input.currentCredit) ||
    input.currentCredit < 0 ||
    !Number.isSafeInteger(input.elapsedTransportSeconds) ||
    input.elapsedTransportSeconds < 0 ||
    !Number.isSafeInteger(input.accessServiceRatePerTransportSecond) ||
    input.accessServiceRatePerTransportSecond < 0
  ) {
    throw new RangeError('traffic:invalid-access-service-credit');
  }
  return (
    input.currentCredit + input.elapsedTransportSeconds * input.accessServiceRatePerTransportSecond
  );
}

function routeIsValid(trip: ActiveTransportTripV2, graph: TrafficGraph): boolean {
  const edgeById = new Map(graph.edges.map((edge) => [edge.edgeId, edge] as const));
  if (
    trip.lastStableNodeId !== '' &&
    !graph.nodes.some((node) => node.nodeId === trip.lastStableNodeId)
  ) {
    return false;
  }
  for (let index = 0; index < trip.routeEdgeIds.length; index += 1) {
    const edge = edgeById.get(trip.routeEdgeIds[index]!);
    if (edge === undefined || edge.mode !== 'Drive') return false;
    if (index > 0) {
      const previous = edgeById.get(trip.routeEdgeIds[index - 1]!);
      if (previous === undefined || previous.toNodeId !== edge.fromNodeId) return false;
    }
  }
  return trip.routeEdgeIds.length > 0;
}

function recoverRoute(
  startNodeId: string,
  destinationNodeId: string | null,
  graph: TrafficGraph,
): readonly string[] | null {
  if (destinationNodeId === null) return null;
  const outgoing = new Map<string, readonly TrafficGraph['edges'][number][]>();
  for (const edge of graph.edges) {
    if (edge.mode !== 'Drive') continue;
    outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge]);
  }
  const queue: Array<{ nodeId: string; route: readonly string[] }> = [
    { nodeId: startNodeId, route: [] },
  ];
  const visited = new Set([startNodeId]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.nodeId === destinationNodeId && current.route.length > 0)
      return Object.freeze(current.route);
    for (const edge of [...(outgoing.get(current.nodeId) ?? [])].sort((a, b) =>
      a.edgeId.localeCompare(b.edgeId),
    )) {
      if (visited.has(edge.toNodeId)) continue;
      visited.add(edge.toNodeId);
      queue.push({ nodeId: edge.toNodeId, route: [...current.route, edge.edgeId] });
    }
  }
  return null;
}

export function reconcileTrafficReservationsAfterRoadMutation(
  input: Readonly<{
    snapshot: TrafficSnapshotV2;
    graph: TrafficGraph;
    destinationAccessNodeIdByTripId: ReadonlyMap<string, string | null>;
    cancelledTripIds?: ReadonlySet<string>;
  }>,
): TrafficSnapshotV2 {
  const cancelled = input.cancelledTripIds ?? new Set<string>();
  const activeTrips = input.snapshot.activeTrips.map((trip) => {
    const clearReservations = (nextTrip: ActiveTransportTripV2): ActiveTransportTripV2 => {
      const cleared: ActiveTransportTripV2 = {
        ...nextTrip,
        entryReservationResourceIds: Object.freeze([]),
        driveMovementPhase: (nextTrip.mode === 'Drive' && nextTrip.status === 'Active'
          ? 'Travelling'
          : null) as ActiveTransportTripV2['driveMovementPhase'],
      };
      Reflect.deleteProperty(cleared, 'activeNodeTraversal');
      return Object.freeze(cleared);
    };
    if (cancelled.has(trip.tripId)) {
      return clearReservations(
        Object.freeze({ ...trip, status: 'Cancelled' as const, failureReason: null }),
      );
    }
    if (trip.status !== 'Active' || trip.mode !== 'Drive') return trip;
    const destination = input.destinationAccessNodeIdByTripId.get(trip.tripId) ?? null;
    if (routeIsValid(trip, input.graph)) return trip;
    const recovered = recoverRoute(trip.lastStableNodeId, destination, input.graph);
    if (recovered === null) {
      return clearReservations(
        Object.freeze({
          ...trip,
          status: 'Failed' as const,
          failureReason: 'UnreachableDestination' as const,
        }),
      );
    }
    return clearReservations(
      Object.freeze({
        ...trip,
        routeEdgeIds: Object.freeze([...recovered]),
        routeGraphRevision: input.graph.sourceRoadRevision,
        segmentIndex: 0,
        progressQ: 0,
        status: 'Active' as const,
        failureReason: null,
      }),
    );
  });
  return createTrafficSnapshotV2({
    ...input.snapshot,
    graphSourceRoadRevision: input.graph.sourceRoadRevision,
    graphSourceBuildingRevision: input.graph.sourceBuildingRevision,
    activeTrips,
  });
}
