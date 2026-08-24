import { Group } from 'three';
import {
  addTrafficInstancedRenderSet,
  createPedestrianInstancedRenderSet,
  type TrafficInstancedRenderSet,
} from './instanced-render-batch.js';
import { TrafficPedestrianAgent, type TrafficPedestrianVisualInput } from './pedestrian-agent.js';
import {
  FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY,
  type TrafficVisualScalePolicy,
} from './visual-scale-policy.js';

export class TrafficPedestrianPool {
  readonly root = new Group();
  readonly #available: TrafficPedestrianAgent[] = [];
  readonly #active = new Map<string, TrafficPedestrianAgent>();
  readonly #scalePolicy: TrafficVisualScalePolicy;
  readonly #renderSet: TrafficInstancedRenderSet;
  #createdCount = 0;
  #reuseCount = 0;
  #disposed = false;
  #renderSetAttached = false;

  constructor(scalePolicy: TrafficVisualScalePolicy = FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY) {
    this.#scalePolicy = scalePolicy;
    this.#renderSet = createPedestrianInstancedRenderSet(scalePolicy);
    this.root.name = 'traffic-pedestrian-root';
    addTrafficInstancedRenderSet(this.root, this.#renderSet);
  }

  get activeCount(): number {
    return this.#active.size;
  }

  get createdCount(): number {
    return this.#createdCount;
  }

  get reuseCount(): number {
    return this.#reuseCount;
  }

  has(tripId: string): boolean {
    return this.#active.has(tripId);
  }

  get(tripId: string): TrafficPedestrianAgent | undefined {
    return this.#active.get(tripId);
  }

  acquire(input: TrafficPedestrianVisualInput): TrafficPedestrianAgent {
    this.#assertUsable();
    const existing = this.#active.get(input.tripId);
    if (existing !== undefined) {
      existing.updateSourceState(input);
      return existing;
    }
    const reused = this.#available.pop();
    const agent = reused ?? this.#createAgent();
    if (reused !== undefined) this.#reuseCount += 1;
    if (agent.tripId !== null) throw new Error('traffic-three:pedestrian-pool-active-reuse');
    agent.assign(input);
    this.#active.set(input.tripId, agent);
    return agent;
  }

  release(tripId: string): void {
    this.#assertUsable();
    const agent = this.#active.get(tripId);
    if (agent === undefined) return;
    this.#active.delete(tripId);
    agent.release();
    this.#available.push(agent);
  }

  retainOnly(tripIds: ReadonlySet<string>): void {
    this.#assertUsable();
    for (const tripId of [...this.#active.keys()]) {
      if (!tripIds.has(tripId)) this.release(tripId);
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const agent of this.#active.values()) agent.dispose();
    for (const agent of this.#available) agent.dispose();
    this.#active.clear();
    this.#available.length = 0;
    this.#renderSet.dispose();
    this.root.clear();
  }

  #createAgent(): TrafficPedestrianAgent {
    const created = new TrafficPedestrianAgent(this.#scalePolicy, this.#renderSet);
    this.root.add(created.object);
    if (!this.#renderSetAttached) {
      addTrafficInstancedRenderSet(this.root, this.#renderSet);
      this.#renderSetAttached = true;
    }
    this.#createdCount += 1;
    return created;
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('traffic-three:pedestrian-pool-disposed');
  }
}
