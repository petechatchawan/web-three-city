import { DirectionalLight, HemisphereLight, type Scene } from "three";

interface LightingMapRead {
  readonly widthCells: number;
  readonly heightCells: number;
  readonly cellSizeMeters: number;
}

export interface CityLightingConfig {
  readonly skyColor: number;
  readonly groundColor: number;
  readonly hemisphereIntensity: number;
  readonly sunColor: number;
  readonly sunIntensity: number;
  readonly sunHorizontalFactor: number;
  readonly sunHeightFactor: number;
}

export const CITY_LIGHTING_DEFAULT_CONFIG: CityLightingConfig = Object.freeze({
  skyColor: 0xdce7f2,
  groundColor: 0x4a4338,
  hemisphereIntensity: 1.25,
  sunColor: 0xffffff,
  sunIntensity: 2.1,
  sunHorizontalFactor: 0.42,
  sunHeightFactor: 0.86,
});

export function createCityLighting(input: {
  readonly scene: Scene;
  readonly map: LightingMapRead;
  readonly config?: CityLightingConfig;
}): { readonly dispose: () => void } {
  const config = input.config ?? CITY_LIGHTING_DEFAULT_CONFIG;
  const widthMeters = input.map.widthCells * input.map.cellSizeMeters;
  const depthMeters = input.map.heightCells * input.map.cellSizeMeters;
  const maxSpanMeters = Math.max(widthMeters, depthMeters);
  const centerX = widthMeters / 2;
  const centerZ = depthMeters / 2;
  const hemisphere = new HemisphereLight(
    config.skyColor,
    config.groundColor,
    config.hemisphereIntensity,
  );
  const sun = new DirectionalLight(config.sunColor, config.sunIntensity);
  sun.position.set(
    centerX - maxSpanMeters * config.sunHorizontalFactor,
    maxSpanMeters * config.sunHeightFactor,
    centerZ - maxSpanMeters * config.sunHorizontalFactor,
  );
  sun.target.position.set(centerX, 0, centerZ);
  input.scene.add(hemisphere, sun, sun.target);

  let disposed = false;
  return Object.freeze({
    dispose(): void {
      if (disposed) return;
      disposed = true;
      input.scene.remove(hemisphere, sun, sun.target);
    },
  });
}
