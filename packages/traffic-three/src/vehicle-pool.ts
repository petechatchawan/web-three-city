import { Group } from 'three';
import {
  addTrafficInstancedRenderSet,
  createVehicleInstancedRenderSet,
  type TrafficSpatialRenderPolicy,
  type TrafficInstancedRenderSet,
} from './instanced-render-batch.js';
import { TrafficVehicleAgent, type TrafficVehicleVisualInput } from './vehicle-agent.js';
import {
  FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY,
  type TrafficVisualScalePolicy,
} from './visual-scale-policy.js';

export class TrafficVehiclePool {
  readonly root = new Group();
  readonly #available: TrafficVehicleAgent[] = [];
  readonly #active = new Map<string, TrafficVehicleAgent>();
  readonly #scalePolicy: TrafficVisualScalePolicy;
  readonly #renderSet: TrafficInstancedRenderSet;
  #createdCount = 0;
  #reuseCount = 0;
  #disposed = false;

  constructor(
    scalePolicy: TrafficVisualScalePolicy = FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY,
    renderPolicy?: TrafficSpatialRenderPolicy,
  ) {
    this.#scalePolicy = scalePolicy;
    this.#renderSet = createVehicleInstancedRenderSet(scalePolicy, renderPolicy);
    this.root.name = 'traffic-vehicle-root';
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

  renderDebugSnapshot() {
    return this.#renderSet.debugSnapshot();
  }

  has(tripId: string): boolean {
    return this.#active.has(tripId);
  }

  get(tripId: string): TrafficVehicleAgent | undefined {
    return this.#active.get(tripId);
  }

  acquire(input: TrafficVehicleVisualInput): TrafficVehicleAgent {
    this.#assertUsable();
    const existing = this.#active.get(input.tripId);
    if (existing !== undefined) {
      existing.updateSourceState(input);
      return existing;
    }
    const reused = this.#available.pop();
    const agent = reused ?? this.#createAgent();
    if (reused !== undefined) this.#reuseCount += 1;
    if (agent.tripId !== null) throw new Error('traffic-three:vehicle-pool-active-reuse');
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

  #createAgent(): TrafficVehicleAgent {
    const created = new TrafficVehicleAgent(this.#scalePolicy, this.#renderSet);
    this.root.add(created.object);
    this.#createdCount += 1;
    return created;
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('traffic-three:vehicle-pool-disposed');
  }
}
