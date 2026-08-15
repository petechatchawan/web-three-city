import {
  TrafficPedestrianPool,
  TrafficVehiclePool,
} from '@web-three-city/traffic-three';
import type { Scene } from 'three';
import type { TrafficPresentationSnapshot } from './traffic-presentation-projection.js';

export class TrafficPresentation {
  readonly #pedestrians = new TrafficPedestrianPool();
  readonly #vehicles = new TrafficVehiclePool();
  #lastTrafficRevision = -1;

  constructor(scene: Scene) {
    scene.add(this.#pedestrians.root, this.#vehicles.root);
  }

  get lastTrafficRevision(): number {
    return this.#lastTrafficRevision;
  }

  update(snapshot: TrafficPresentationSnapshot): void {
    const retainedPedestrians = new Set<string>();
    const retainedVehicles = new Set<string>();
    for (const agent of snapshot.agents) {
      if (agent.mode === 'Walk') {
        retainedPedestrians.add(agent.tripId);
        this.#pedestrians.acquire({
          tripId: agent.tripId,
          citizenId: agent.citizenId,
          routeEdgeId: agent.routeEdgeId,
          progressQ: agent.progressQ,
          queued: agent.queued,
          from: agent.from,
          to: agent.to,
        });
        continue;
      }
      retainedVehicles.add(agent.tripId);
      this.#vehicles.acquire({
        tripId: agent.tripId,
        citizenId: agent.citizenId,
        routeEdgeId: agent.routeEdgeId,
        progressQ: agent.progressQ,
        queued: agent.queued,
        from: agent.from,
        to: agent.to,
        turn: agent.turn,
      });
    }
    this.#pedestrians.retainOnly(retainedPedestrians);
    this.#vehicles.retainOnly(retainedVehicles);
    this.#lastTrafficRevision = snapshot.trafficRevision;
  }

  clear(): void {
    this.#pedestrians.retainOnly(new Set());
    this.#vehicles.retainOnly(new Set());
    this.#lastTrafficRevision = -1;
  }

  debugSnapshot(): Readonly<{
    trafficRevision: number;
    pedestrianCount: number;
    vehicleCount: number;
    createdPedestrianCount: number;
    reusedPedestrianCount: number;
    createdVehicleCount: number;
    reusedVehicleCount: number;
  }> {
    return Object.freeze({
      trafficRevision: this.#lastTrafficRevision,
      pedestrianCount: this.#pedestrians.activeCount,
      vehicleCount: this.#vehicles.activeCount,
      createdPedestrianCount: this.#pedestrians.createdCount,
      reusedPedestrianCount: this.#pedestrians.reuseCount,
      createdVehicleCount: this.#vehicles.createdCount,
      reusedVehicleCount: this.#vehicles.reuseCount,
    });
  }

  dispose(): void {
    this.#pedestrians.root.removeFromParent();
    this.#vehicles.root.removeFromParent();
    this.#pedestrians.dispose();
    this.#vehicles.dispose();
  }
}
