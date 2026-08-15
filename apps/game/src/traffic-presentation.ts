import { TrafficPedestrianPool } from '@web-three-city/traffic-three';
import type { Scene } from 'three';
import type { TrafficPresentationSnapshot } from './traffic-presentation-projection.js';

export class TrafficPresentation {
  readonly #pedestrians = new TrafficPedestrianPool();
  #lastTrafficRevision = -1;

  constructor(scene: Scene) {
    scene.add(this.#pedestrians.root);
  }

  get lastTrafficRevision(): number {
    return this.#lastTrafficRevision;
  }

  update(snapshot: TrafficPresentationSnapshot): void {
    const retained = new Set<string>();
    for (const agent of snapshot.agents) {
      if (agent.mode !== 'Walk') continue;
      retained.add(agent.tripId);
      this.#pedestrians.acquire({
        tripId: agent.tripId,
        citizenId: agent.citizenId,
        routeEdgeId: agent.routeEdgeId,
        progressQ: agent.progressQ,
        queued: agent.queued,
        from: agent.from,
        to: agent.to,
      });
    }
    this.#pedestrians.retainOnly(retained);
    this.#lastTrafficRevision = snapshot.trafficRevision;
  }

  clear(): void {
    this.#pedestrians.retainOnly(new Set());
    this.#lastTrafficRevision = -1;
  }

  debugSnapshot(): Readonly<{
    trafficRevision: number;
    pedestrianCount: number;
    createdPedestrianCount: number;
    reusedPedestrianCount: number;
  }> {
    return Object.freeze({
      trafficRevision: this.#lastTrafficRevision,
      pedestrianCount: this.#pedestrians.activeCount,
      createdPedestrianCount: this.#pedestrians.createdCount,
      reusedPedestrianCount: this.#pedestrians.reuseCount,
    });
  }

  dispose(): void {
    this.#pedestrians.root.removeFromParent();
    this.#pedestrians.dispose();
  }
}
