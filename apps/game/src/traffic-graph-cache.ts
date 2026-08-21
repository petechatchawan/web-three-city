export interface TrafficGraphCache<T> {
  get(roads: object, buildingEnvironment: object, buildings: object, create: () => T): T;
}

/**
 * Caches the derived Traffic graph for the immutable static authority that produced it.
 * Transport quanta may replace dynamic Traffic state without invalidating this graph.
 */
export function createTrafficGraphCache<T>(): TrafficGraphCache<T> {
  let cachedRoads: object | null = null;
  let cachedBuildingEnvironment: object | null = null;
  let cachedBuildings: object | null = null;
  let cached: Readonly<{ value: T }> | undefined;

  return Object.freeze({
    get(roads: object, buildingEnvironment: object, buildings: object, create: () => T): T {
      if (
        cached !== undefined &&
        cachedRoads === roads &&
        cachedBuildingEnvironment === buildingEnvironment &&
        cachedBuildings === buildings
      ) {
        return cached.value;
      }
      const next = create();
      cachedRoads = roads;
      cachedBuildingEnvironment = buildingEnvironment;
      cachedBuildings = buildings;
      cached = Object.freeze({ value: next });
      return next;
    },
  });
}
