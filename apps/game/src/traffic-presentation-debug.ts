export interface TrafficPresentationDebugSnapshot {
  readonly trafficRevision: number;
  readonly logicalActiveTrips: number;
  readonly spatialCandidates: number;
  readonly visiblePedestrians: number;
  readonly visibleVehicles: number;
  readonly nearAgents: number;
  readonly midAgents: number;
  readonly poolReuseCount: number;
  readonly visitedSpatialBuckets: number;
  readonly totalSpatialBuckets: number;
  readonly nearUpdateCount: number;
  readonly midUpdateCount: number;
  readonly journeyReplayCount: number;
  readonly journeyReplayPedestrians: number;
  readonly journeyReplayVehicles: number;
  readonly reconciliationCount: number;
  readonly frameSampleCount: number;
  readonly preparedRouteCount: number;
  readonly lastFrameTimestampMs: number;
}

export const EMPTY_TRAFFIC_PRESENTATION_DEBUG: TrafficPresentationDebugSnapshot = Object.freeze({
  trafficRevision: -1,
  logicalActiveTrips: 0,
  spatialCandidates: 0,
  visiblePedestrians: 0,
  visibleVehicles: 0,
  nearAgents: 0,
  midAgents: 0,
  poolReuseCount: 0,
  visitedSpatialBuckets: 0,
  totalSpatialBuckets: 0,
  nearUpdateCount: 0,
  midUpdateCount: 0,
  journeyReplayCount: 0,
  journeyReplayPedestrians: 0,
  journeyReplayVehicles: 0,
  reconciliationCount: 0,
  frameSampleCount: 0,
  preparedRouteCount: 0,
  lastFrameTimestampMs: -1,
});
