import {
  compareTrafficId,
  type IntersectionMovementKind,
  type NodeTraversalClass,
} from './contracts.js';
import { INTERSECTION_AGE_PROMOTION_SECONDS } from './intersection-policy.js';
import {
  acquireTrafficReservationBundle,
  createTrafficReservationLedger,
  type TrafficReservationLedger,
} from './traffic-reservation.js';
import { type TrafficScaleInstrumentation } from './traffic-scale-instrumentation.js';
import {
  compareTransportSeconds,
  transportSecondDuration,
  transportSecondDurationBetween,
  transportSecondValue,
  type AbsoluteTransportSecond,
} from './transport-time.js';

const intersectionAgePromotion = transportSecondDuration(INTERSECTION_AGE_PROMOTION_SECONDS);

export interface IntersectionArbitrationCandidate {
  readonly tripId: string;
  readonly nodeId: string;
  readonly traversalClass: NodeTraversalClass;
  readonly incomingEdgeId: string;
  readonly outgoingEdgeId: string;
  readonly movementKind?: IntersectionMovementKind;
  readonly queuedAtTransportSecond: AbsoluteTransportSecond;
  /** Larger progress is physically closer to the node. */
  readonly lanePositionQ: number;
  readonly resourceIds: readonly string[];
}

export interface IntersectionArbitrationResult {
  readonly grantedTripIds: readonly string[];
  readonly waitingTripIds: readonly string[];
  readonly ledger: TrafficReservationLedger;
}

function movementPriority(kind: IntersectionMovementKind | undefined): number {
  return kind === 'Straight' ? 0 : kind === 'Right' ? 1 : 2;
}

function compareFront(
  first: IntersectionArbitrationCandidate,
  second: IntersectionArbitrationCandidate,
): number {
  if (first.lanePositionQ !== second.lanePositionQ)
    return second.lanePositionQ - first.lanePositionQ;
  const queuedAtOrder = compareTransportSeconds(
    first.queuedAtTransportSecond,
    second.queuedAtTransportSecond,
  );
  if (queuedAtOrder !== 0) return queuedAtOrder;
  return compareTrafficId(first.tripId, second.tripId);
}

function comparePriority(
  first: IntersectionArbitrationCandidate,
  second: IntersectionArbitrationCandidate,
  currentTransportSecond: AbsoluteTransportSecond,
): number {
  const ageOf = (queuedAtTransportSecond: AbsoluteTransportSecond) =>
    compareTransportSeconds(currentTransportSecond, queuedAtTransportSecond) < 0
      ? null
      : transportSecondDurationBetween(currentTransportSecond, queuedAtTransportSecond);
  const firstAge = ageOf(first.queuedAtTransportSecond);
  const secondAge = ageOf(second.queuedAtTransportSecond);
  const firstPromoted =
    firstAge !== null &&
    transportSecondValue(firstAge) >= transportSecondValue(intersectionAgePromotion);
  const secondPromoted =
    secondAge !== null &&
    transportSecondValue(secondAge) >= transportSecondValue(intersectionAgePromotion);
  if (firstPromoted !== secondPromoted) return firstPromoted ? -1 : 1;
  const queuedAtOrder = compareTransportSeconds(
    first.queuedAtTransportSecond,
    second.queuedAtTransportSecond,
  );
  if (queuedAtOrder !== 0) return queuedAtOrder;
  const firstPriority = movementPriority(first.movementKind);
  const secondPriority = movementPriority(second.movementKind);
  if (firstPriority !== secondPriority) return firstPriority - secondPriority;
  return compareTrafficId(first.tripId, second.tripId);
}

/**
 * Selects a deterministic maximal compatible set. Resources are acquired as
 * complete bundles, so a rejected candidate never owns a partial bundle.
 */
export function arbitrateIntersectionMovements(
  input: Readonly<{
    candidates: readonly IntersectionArbitrationCandidate[];
    ledger?: TrafficReservationLedger;
    currentTransportSecond: AbsoluteTransportSecond;
    scaleInstrumentation?: TrafficScaleInstrumentation;
  }>,
): IntersectionArbitrationResult {
  const frontByIncoming = new Map<string, IntersectionArbitrationCandidate>();
  for (const candidate of input.candidates) {
    input.scaleInstrumentation?.recordArbitrationCandidate();
    const front = frontByIncoming.get(candidate.incomingEdgeId);
    if (front === undefined || compareFront(candidate, front) < 0) {
      frontByIncoming.set(candidate.incomingEdgeId, candidate);
    }
  }
  const eligible = [...frontByIncoming.values()].sort((first, second) =>
    comparePriority(first, second, input.currentTransportSecond),
  );
  let ledger = input.ledger ?? createTrafficReservationLedger();
  const granted: string[] = [];
  for (const candidate of eligible) {
    input.scaleInstrumentation?.recordArbitrationResourceChecks(candidate.resourceIds.length);
    const acquired = acquireTrafficReservationBundle({
      ledger,
      tripId: candidate.tripId,
      resourceIds: candidate.resourceIds,
    });
    if (!acquired.granted) continue;
    ledger = acquired.ledger;
    granted.push(candidate.tripId);
  }
  const grantedSet = new Set(granted);
  return Object.freeze({
    grantedTripIds: Object.freeze(granted),
    waitingTripIds: Object.freeze(
      input.candidates
        .filter((candidate) => !grantedSet.has(candidate.tripId))
        .map((candidate) => candidate.tripId)
        .sort(compareTrafficId),
    ),
    ledger,
  });
}
