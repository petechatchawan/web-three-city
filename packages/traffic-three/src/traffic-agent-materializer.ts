import {
  FOUNDATION_TRAFFIC_PRESENTATION_POLICY,
  type TrafficPresentationPolicy,
} from './materialization-policy.js';
import type { TrafficSpatialAgent, TrafficSpatialCandidate } from './traffic-spatial-index.js';

export type TrafficLodTier = 'Near' | 'Mid';

export interface MaterializedTrafficAgent<T extends TrafficSpatialAgent = TrafficSpatialAgent> {
  readonly agent: T;
  readonly tier: TrafficLodTier;
  readonly distanceSquared: number;
}

export interface TrafficMaterializationSelection<T extends TrafficSpatialAgent = TrafficSpatialAgent> {
  readonly selected: readonly MaterializedTrafficAgent<T>[];
  readonly pedestrianCount: number;
  readonly vehicleCount: number;
  readonly nearCount: number;
  readonly midCount: number;
}

function modePriority(mode: TrafficSpatialAgent['mode']): number {
  return mode === 'Walk' ? 0 : 1;
}

function compareCandidates<T extends TrafficSpatialAgent>(
  first: TrafficSpatialCandidate<T>,
  second: TrafficSpatialCandidate<T>,
): number {
  if (first.distanceSquared !== second.distanceSquared) {
    return first.distanceSquared - second.distanceSquared;
  }
  const modeOrder = modePriority(first.agent.mode) - modePriority(second.agent.mode);
  if (modeOrder !== 0) return modeOrder;
  return first.agent.tripId < second.agent.tripId ? -1 : first.agent.tripId > second.agent.tripId ? 1 : 0;
}

export function selectTrafficAgentsForMaterialization<T extends TrafficSpatialAgent>(input: Readonly<{
  candidates: readonly TrafficSpatialCandidate<T>[];
  frameIndex: number;
  policy?: TrafficPresentationPolicy;
}>): TrafficMaterializationSelection<T> {
  const policy = input.policy ?? FOUNDATION_TRAFFIC_PRESENTATION_POLICY;
  if (!Number.isSafeInteger(input.frameIndex) || input.frameIndex < 0) {
    throw new RangeError('traffic-three:invalid-frame-index');
  }
  const nearRadiusSquared = policy.nearRadiusMeters * policy.nearRadiusMeters;
  const midRadiusSquared = policy.midRadiusMeters * policy.midRadiusMeters;
  const sorted = [...input.candidates]
    .filter((candidate) => candidate.distanceSquared <= midRadiusSquared)
    .sort(compareCandidates);
  const selected: MaterializedTrafficAgent<T>[] = [];
  let pedestrians = 0;
  let vehicles = 0;
  let near = 0;
  let mid = 0;

  for (const candidate of sorted) {
    if (candidate.agent.mode === 'Walk' && pedestrians >= policy.maxPedestrians) continue;
    if (candidate.agent.mode === 'Drive' && vehicles >= policy.maxVehicles) continue;

    const eligibleForNear =
      candidate.distanceSquared <= nearRadiusSquared && near < policy.maxCombinedFullDetail;
    const tier: TrafficLodTier = eligibleForNear ? 'Near' : 'Mid';
    const updateEvery =
      tier === 'Near' ? policy.nearUpdateEveryFrames : policy.midUpdateEveryFrames;
    if (input.frameIndex % updateEvery !== 0) continue;

    selected.push(Object.freeze({ agent: candidate.agent, tier, distanceSquared: candidate.distanceSquared }));
    if (candidate.agent.mode === 'Walk') pedestrians += 1;
    else vehicles += 1;
    if (tier === 'Near') near += 1;
    else mid += 1;
  }

  return Object.freeze({
    selected: Object.freeze(selected),
    pedestrianCount: pedestrians,
    vehicleCount: vehicles,
    nearCount: near,
    midCount: mid,
  });
}
