import type { TrafficMode } from './contracts.js';
import type { TransportRouteCandidate } from './route-planner.js';

export interface RouteCacheKey {
  readonly mode: TrafficMode;
  readonly originAccessNodeId: string;
  readonly destinationAccessNodeId: string;
  readonly roadGraphRevision: number;
  readonly trafficCostRevision: number;
  readonly routingPolicyVersion: 1;
}

function keyOf(key: RouteCacheKey): string {
  return [
    key.mode,
    key.originAccessNodeId,
    key.destinationAccessNodeId,
    key.roadGraphRevision,
    key.trafficCostRevision,
    key.routingPolicyVersion,
  ].join('|');
}

function cloneCandidate(candidate: TransportRouteCandidate): TransportRouteCandidate {
  return Object.freeze({
    ...candidate,
    routeEdgeIds: Object.freeze([...candidate.routeEdgeIds]),
  });
}

export class TrafficRouteCache {
  readonly #cache = new Map<string, TransportRouteCandidate>();

  get size(): number {
    return this.#cache.size;
  }

  get(key: RouteCacheKey): TransportRouteCandidate | null {
    const value = this.#cache.get(keyOf(key));
    return value === undefined ? null : cloneCandidate(value);
  }

  set(key: RouteCacheKey, candidate: TransportRouteCandidate): void {
    this.#cache.set(keyOf(key), cloneCandidate(candidate));
  }

  getOrCreate(key: RouteCacheKey, factory: () => TransportRouteCandidate): TransportRouteCandidate {
    const existing = this.get(key);
    if (existing !== null) return existing;
    const candidate = factory();
    this.set(key, candidate);
    return cloneCandidate(candidate);
  }

  clear(): void {
    this.#cache.clear();
  }
}
