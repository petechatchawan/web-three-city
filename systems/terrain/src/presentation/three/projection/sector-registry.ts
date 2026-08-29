import {
  compareRenderSectorCoord,
  renderSectorKey,
  type RenderSectorCoord,
} from "../topology/render-sector";
import type { SectorResource } from "../resources/sector-resource";

export interface SectorRegistry {
  size(): number;
  get(coord: RenderSectorCoord): SectorResource | undefined;
  insert(resource: SectorResource): void;
  replace(resource: SectorResource): SectorResource;
  values(): readonly SectorResource[];
  clear(): readonly SectorResource[];
}

function canonicalValues(
  resources: ReadonlyMap<string, SectorResource>,
): readonly SectorResource[] {
  return Object.freeze(
    [...resources.values()].sort((left, right) =>
      compareRenderSectorCoord(left.coord, right.coord),
    ),
  );
}

export function createSectorRegistry(): SectorRegistry {
  const resources = new Map<string, SectorResource>();

  const registry: SectorRegistry = {
    size: () => resources.size,
    get(coord) {
      return resources.get(renderSectorKey(coord));
    },
    insert(resource) {
      const key = renderSectorKey(resource.coord);
      if (resources.has(key)) {
        throw new Error(`Render sector ${key} is already registered.`);
      }
      resources.set(key, resource);
    },
    replace(resource) {
      const key = renderSectorKey(resource.coord);
      const previous = resources.get(key);
      if (previous === undefined) {
        throw new Error(`Render sector ${key} is not registered.`);
      }
      resources.set(key, resource);
      return previous;
    },
    values() {
      return canonicalValues(resources);
    },
    clear() {
      const previous = canonicalValues(resources);
      resources.clear();
      return previous;
    },
  };

  return Object.freeze(registry);
}
