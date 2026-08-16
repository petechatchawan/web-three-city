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
  readonly updateDue: boolean;
}

export interface TrafficMaterializationSelection<
  T extends TrafficSpatialAgent = TrafficSpatialAgent,
> {
  readonly selected: readonly MaterializedTrafficAgent<T>[];
  readonly pedestrianCount: number;
  readonly vehicleCount: number;
  readonly nearCount: number;
  readonly midCount: number;
  readonly nearUpdateCount: number;
  readonly midUpdateCount: number;
}

interface MaterializationCounters {
  pedestrians: number;
  vehicles: number;
  near: number;
  mid: number;
  nearUpdateCount: number;
  midUpdateCount: number;
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
  return first.agent.tripId < second.agent.tripId
    ? -1
    : first.agent.tripId > second.agent.tripId
      ? 1
      : 0;
}

function modeCapacityReached(
  mode: TrafficSpatialAgent['mode'],
  counters: MaterializationCounters,
  policy: TrafficPresentationPolicy,
): boolean {
  return mode === 'Walk'
    ? counters.pedestrians >= policy.maxPedestrians
    : counters.vehicles >= policy.maxVehicles;
}

function materializeCandidate<T extends TrafficSpatialAgent>(
  candidate: TrafficSpatialCandidate<T>,
  frameIndex: number,
  policy: TrafficPresentationPolicy,
  counters: MaterializationCounters,
  nearRadiusSquared: number,
): MaterializedTrafficAgent<T> | null {
  if (modeCapacityReached(candidate.agent.mode, counters, policy)) return null;
  const tier: TrafficLodTier =
    candidate.distanceSquared <= nearRadiusSquared && counters.near < policy.maxCombinedFullDetail
      ? 'Near'
      : 'Mid';
  const updateEvery =
    tier === 'Near' ? policy.nearUpdateEveryFrames : policy.midUpdateEveryFrames;
  return Object.freeze({
    agent: candidate.agent,
    tier,
    distanceSquared: candidate.distanceSquared,
    updateDue: frameIndex % updateEvery === 0,
  });
}

function recordMaterialized(
  selection: MaterializedTrafficAgent,
  counters: MaterializationCounters,
): void {
  if (selection.agent.mode === 'Walk') counters.pedestrians += 1;
  else counters.vehicles += 1;
  if (selection.tier === 'Near') {
    counters.near += 1;
    if (selection.updateDue) counters.nearUpdateCount += 1;
    return;
  }
  counters.mid += 1;
  if (selection.updateDue) counters.midUpdateCount += 1;
}

export function selectTrafficAgentsForMaterialization<T extends TrafficSpatialAgent>(
  input: Readonly<{
    candidates: readonly TrafficSpatialCandidate<T>[];
    frameIndex: number;
    policy?: TrafficPresentationPolicy;
  }>,
): TrafficMaterializationSelection<T> {
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
  const counters: MaterializationCounters = {
    pedestrians: 0,
    vehicles: 0,
    near: 0,
    mid: 0,
    nearUpdateCount: 0,
    midUpdateCount: 0,
  };

  for (const candidate of sorted) {
    const materialized = materializeCandidate(
      candidate,
      input.frameIndex,
      policy,
      counters,
      nearRadiusSquared,
    );
    if (materialized === null) continue;
    selected.push(materialized);
    recordMaterialized(materialized, counters);
  }

  return Object.freeze({
    selected: Object.freeze(selected),
    pedestrianCount: counters.pedestrians,
    vehicleCount: counters.vehicles,
    nearCount: counters.near,
    midCount: counters.mid,
    nearUpdateCount: counters.nearUpdateCount,
    midUpdateCount: counters.midUpdateCount,
  });
}
