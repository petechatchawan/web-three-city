import type { BuildingDevelopmentEnvironment } from '@web-three-city/building-core';
import type { RoadSnapshot } from '@web-three-city/road-core';
import type { RoadTrafficSourceProjection } from '@web-three-city/traffic-core';
import { createRoadTrafficSourceProjectionFromEnvironment } from './traffic-source-projection.js';

export type RoadTrafficSourceProjectionDeriver = (
  roads: RoadSnapshot,
  environment: Pick<BuildingDevelopmentEnvironment, 'surfaceAt'>,
) => RoadTrafficSourceProjection;

export interface RoadTrafficSourceProjectionProvider {
  get(
    roads: RoadSnapshot,
    environment: Pick<BuildingDevelopmentEnvironment, 'surfaceAt'>,
  ): RoadTrafficSourceProjection;
}

export function createRoadTrafficSourceProjectionProvider(
  derive: RoadTrafficSourceProjectionDeriver = createRoadTrafficSourceProjectionFromEnvironment,
): RoadTrafficSourceProjectionProvider {
  let cachedRoads: RoadSnapshot | null = null;
  let cachedEnvironment: Pick<BuildingDevelopmentEnvironment, 'surfaceAt'> | null = null;
  let cachedProjection: RoadTrafficSourceProjection | null = null;

  return Object.freeze({
    get(
      roads: RoadSnapshot,
      environment: Pick<BuildingDevelopmentEnvironment, 'surfaceAt'>,
    ): RoadTrafficSourceProjection {
      if (cachedProjection !== null && cachedRoads === roads && cachedEnvironment === environment) {
        return cachedProjection;
      }
      const projection = derive(roads, environment);
      cachedRoads = roads;
      cachedEnvironment = environment;
      cachedProjection = projection;
      return projection;
    },
  });
}
