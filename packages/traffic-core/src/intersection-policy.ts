import type { TrafficCardinalDirection } from './contracts.js';

export interface FoundationIntersectionPolicyV1 {
  readonly version: 1;
  readonly serviceIntervalSeconds: number;
  readonly straightPriority: number;
  readonly rightTurnPriority: number;
  readonly leftTurnPriority: number;
  readonly uTurnPriority: number;
}

export const FOUNDATION_INTERSECTION_POLICY_V1: FoundationIntersectionPolicyV1 = Object.freeze({
  version: 1,
  serviceIntervalSeconds: 4,
  straightPriority: 0,
  rightTurnPriority: 1,
  leftTurnPriority: 2,
  uTurnPriority: 3,
});

const ORDER: readonly TrafficCardinalDirection[] = Object.freeze(['N', 'E', 'S', 'W']);

function indexOf(direction: TrafficCardinalDirection): number {
  return ORDER.indexOf(direction);
}

export function intersectionMovementPriority(
  incoming: TrafficCardinalDirection,
  outgoing: TrafficCardinalDirection,
  policy: FoundationIntersectionPolicyV1 = FOUNDATION_INTERSECTION_POLICY_V1,
): number {
  const turn = (indexOf(outgoing) - indexOf(incoming) + 4) % 4;
  if (turn === 0) return policy.uTurnPriority;
  if (turn === 1) return policy.leftTurnPriority;
  if (turn === 2) return policy.straightPriority;
  return policy.rightTurnPriority;
}
