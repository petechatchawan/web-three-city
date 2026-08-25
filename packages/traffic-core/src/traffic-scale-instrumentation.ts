export interface TrafficScaleWorkSnapshot {
  readonly laneBucketTripWrites: number;
  readonly neighborChecks: number;
  readonly arbitrationCandidateCount: number;
  readonly arbitrationResourceChecks: number;
  readonly graphMetadataBuildCount: number;
  readonly graphMetadataReuseCount: number;
  readonly flowTripVisits: number;
  readonly flowEdgeVisits: number;
}

/**
 * Ephemeral observability for deterministic scale tests and release fixtures.
 * It records work performed; it never participates in Traffic authority.
 */
export class TrafficScaleInstrumentation {
  #laneBucketTripWrites = 0;
  #neighborChecks = 0;
  #arbitrationCandidateCount = 0;
  #arbitrationResourceChecks = 0;
  #graphMetadataBuildCount = 0;
  #graphMetadataReuseCount = 0;
  #flowTripVisits = 0;
  #flowEdgeVisits = 0;

  recordLaneBucketTripWrite(): void {
    this.#laneBucketTripWrites += 1;
  }

  recordNeighborCheck(): void {
    this.#neighborChecks += 1;
  }

  recordArbitrationCandidate(): void {
    this.#arbitrationCandidateCount += 1;
  }

  recordArbitrationResourceChecks(count: number): void {
    this.#arbitrationResourceChecks += count;
  }

  recordGraphMetadataBuild(): void {
    this.#graphMetadataBuildCount += 1;
  }

  recordGraphMetadataReuse(): void {
    this.#graphMetadataReuseCount += 1;
  }

  recordFlowTripVisit(): void {
    this.#flowTripVisits += 1;
  }

  recordFlowEdgeVisit(): void {
    this.#flowEdgeVisits += 1;
  }

  snapshot(): TrafficScaleWorkSnapshot {
    return Object.freeze({
      laneBucketTripWrites: this.#laneBucketTripWrites,
      neighborChecks: this.#neighborChecks,
      arbitrationCandidateCount: this.#arbitrationCandidateCount,
      arbitrationResourceChecks: this.#arbitrationResourceChecks,
      graphMetadataBuildCount: this.#graphMetadataBuildCount,
      graphMetadataReuseCount: this.#graphMetadataReuseCount,
      flowTripVisits: this.#flowTripVisits,
      flowEdgeVisits: this.#flowEdgeVisits,
    });
  }
}

export function createTrafficScaleInstrumentation(): TrafficScaleInstrumentation {
  return new TrafficScaleInstrumentation();
}
