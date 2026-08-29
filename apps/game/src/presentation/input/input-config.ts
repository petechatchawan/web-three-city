export interface CityInputConfig {
  readonly tapThresholdPixels: number;
  readonly rotateRadiansPerPixel: number;
  readonly zoomWheelExponentPerPixel: number;
  readonly panDistancePerViewportHeightFactor: number;
  readonly multiTouchDistanceEpsilonPixels: number;
}

export const CITY_INPUT_DEFAULT_CONFIG: CityInputConfig = Object.freeze({
  tapThresholdPixels: 9,
  rotateRadiansPerPixel: 0.006,
  zoomWheelExponentPerPixel: 0.0015,
  panDistancePerViewportHeightFactor: 1.1,
  multiTouchDistanceEpsilonPixels: 0.5,
});
