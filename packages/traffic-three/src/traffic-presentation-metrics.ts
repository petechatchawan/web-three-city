export interface TrafficSpatialQueryMetrics {
  readonly bucketCount: number;
  readonly visitedBucketCount: number;
  readonly candidateTripCount: number;
}

export interface TrafficPresentationMetricsSnapshot {
  readonly logicalTripCount: number;
  readonly queriedBucketCount: number;
  readonly visitedBucketCount: number;
  readonly spatialCandidateCount: number;
  readonly eligibleVisualCount: number;
  readonly materializedPedestrianCount: number;
  readonly materializedVehicleCount: number;
  readonly nearAgentCount: number;
  readonly midAgentCount: number;
  readonly pedestrianPoolCreatedCount: number;
  readonly pedestrianPoolReuseCount: number;
  readonly vehiclePoolCreatedCount: number;
  readonly vehiclePoolReuseCount: number;
  readonly nearUpdateCount: number;
  readonly midUpdateCount: number;
}

export function emptyTrafficPresentationMetrics(): TrafficPresentationMetricsSnapshot {
  return Object.freeze({
    logicalTripCount: 0,
    queriedBucketCount: 0,
    visitedBucketCount: 0,
    spatialCandidateCount: 0,
    eligibleVisualCount: 0,
    materializedPedestrianCount: 0,
    materializedVehicleCount: 0,
    nearAgentCount: 0,
    midAgentCount: 0,
    pedestrianPoolCreatedCount: 0,
    pedestrianPoolReuseCount: 0,
    vehiclePoolCreatedCount: 0,
    vehiclePoolReuseCount: 0,
    nearUpdateCount: 0,
    midUpdateCount: 0,
  });
}
