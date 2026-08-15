export interface TrafficPresentationPolicy {
  readonly maxPedestrians: number;
  readonly maxVehicles: number;
  readonly maxCombinedFullDetail: number;
  readonly nearRadiusMeters: number;
  readonly midRadiusMeters: number;
  readonly nearUpdateEveryFrames: number;
  readonly midUpdateEveryFrames: number;
  readonly vehicleMinimumHeadwayMillimeters: number;
}

export const FOUNDATION_TRAFFIC_PRESENTATION_POLICY: TrafficPresentationPolicy = Object.freeze({
  maxPedestrians: 300,
  maxVehicles: 300,
  maxCombinedFullDetail: 500,
  nearRadiusMeters: 96,
  midRadiusMeters: 192,
  nearUpdateEveryFrames: 1,
  midUpdateEveryFrames: 3,
  vehicleMinimumHeadwayMillimeters: 4_500,
});
