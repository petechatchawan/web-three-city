import { Group } from 'three';
import { TrafficPedestrianAgent, type TrafficPedestrianVisualInput } from './pedestrian-agent.js';

export class TrafficPedestrianPool {
  readonly root = new Group();
  readonly #available: TrafficPedestrianAgent[] = [];
  readonly #active = new Map<string, TrafficPedestrianAgent>();
  #createdCount = 0;
  #reuseCount = 0;

  constructor() {
    this.root.name = 'traffic-pedestrian-root';
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

  acquire(input: TrafficPedestrianVisualInput): TrafficPedestrianAgent {
    const existing = this.#active.get(input.tripId);
    if (existing !== undefined) {
      existing.assign(input);
      return existing;
    }
    const reused = this.#available.pop();
    const agent = reused ?? (() => {
      const created = new TrafficPedestrianAgent();
      this.root.add(created.object);
      this.#createdCount += 1;
      return created;
    })();
    if (reused !== undefined) this.#reuseCount += 1;
    if (agent.tripId !== null) throw new Error('traffic-three:pedestrian-pool-active-reuse');
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
}
