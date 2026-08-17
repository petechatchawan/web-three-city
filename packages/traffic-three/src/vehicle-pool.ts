import { Group } from 'three';
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
  #createdCount = 0;
  #reuseCount = 0;

  constructor(scalePolicy: TrafficVisualScalePolicy = FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY) {
    this.#scalePolicy = scalePolicy;
    this.root.name = 'traffic-vehicle-root';
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

  get(tripId: string): TrafficVehicleAgent | undefined {
    return this.#active.get(tripId);
  }

  acquire(input: TrafficVehicleVisualInput): TrafficVehicleAgent {
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
    const agent = this.#active.get(tripId);
    if (agent === undefined) return;
    this.#active.delete(tripId);
    agent.release();
    this.#available.push(agent);
  }

  retainOnly(tripIds: ReadonlySet<string>): void {
    for (const tripId of [...this.#active.keys()]) {
      if (!tripIds.has(tripId)) this.release(tripId);
    }
  }

  dispose(): void {
    for (const agent of this.#active.values()) agent.dispose();
    for (const agent of this.#available) agent.dispose();
    this.#active.clear();
    this.#available.length = 0;
    this.root.clear();
  }

  #createAgent(): TrafficVehicleAgent {
    const created = new TrafficVehicleAgent(this.#scalePolicy);
    this.root.add(created.object);
    this.#createdCount += 1;
    return created;
  }
}
