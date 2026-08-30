import { Group, type Material } from "three";
import type {
  CreateTerrainThreeProjectionInput,
  TerrainThreeProjection,
  TerrainThreeProjectionConstructionResult,
} from "../../../contracts/terrain-three";
import type { TerrainRevision } from "../../../contracts/terrain-read";
import {
  buildSectorGeometryData,
  createSectorBufferGeometry,
} from "../geometry/build-sector-geometry";
import { readSectorSurface } from "../geometry/read-sector-surface";
import { pickSemanticTerrain } from "../picking/semantic-pick";
import {
  createSectorResource,
  type SectorResource,
} from "../resources/sector-resource";
import { createTerrainMaterial } from "../resources/terrain-material";
import { computeDirtyRenderSectors } from "../topology/dirty-sectors";
import {
  allRenderSectorCoords,
  createRenderSectorLayout,
  type RenderSectorCoord,
  type RenderSectorLayout,
} from "../topology/render-sector";
import { createSectorRegistry, type SectorRegistry } from "./sector-registry";

interface ProjectionBuildContext {
  readonly layout: RenderSectorLayout;
  readonly world: CreateTerrainThreeProjectionInput["world"];
  readonly terrain: CreateTerrainThreeProjectionInput["terrain"];
  readonly material: Material;
}

function buildSectorResource(
  coord: RenderSectorCoord,
  expectedRevision: TerrainRevision,
  context: ProjectionBuildContext,
): SectorResource {
  const snapshot = readSectorSurface({
    layout: context.layout,
    sector: coord,
    terrain: context.terrain,
  });
  if (snapshot.revision !== expectedRevision) {
    throw new Error(
      `Terrain projection sector snapshot revision mismatch: expected ${expectedRevision}, received ${snapshot.revision}.`,
    );
  }

  const data = buildSectorGeometryData({
    layout: context.layout,
    sector: coord,
    snapshot,
    world: context.world,
  });
  return createSectorResource({
    coord,
    geometry: createSectorBufferGeometry(data),
    material: context.material,
  });
}

function disposeRegistryResources(root: Group, registry: SectorRegistry): void {
  for (const resource of registry.clear()) {
    root.remove(resource.mesh);
    resource.dispose();
  }
}

function assertCurrentRevision(
  actual: TerrainRevision,
  expected: TerrainRevision,
  message: string,
): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}.`);
  }
}

export function createTerrainThreeProjectionInternal(
  input: CreateTerrainThreeProjectionInput,
): TerrainThreeProjectionConstructionResult {
  if (input.terrain.completeness() !== "full") {
    return {
      status: "rejected",
      code: "TERRAIN_PRESENTATION_TERRAIN_INCOMPLETE",
    };
  }

  const layout = createRenderSectorLayout(input.mapDefinition);
  const root = new Group();
  root.name = "terrain-projection";
  const material = createTerrainMaterial();
  const registry = createSectorRegistry();
  let projectedRevision = input.terrain.revision();
  let disposed = false;

  const context: ProjectionBuildContext = {
    layout,
    world: input.world,
    terrain: input.terrain,
    material,
  };

  try {
    for (const coord of allRenderSectorCoords(layout)) {
      const resource = buildSectorResource(coord, projectedRevision, context);
      registry.insert(resource);
      root.add(resource.mesh);
    }
    assertCurrentRevision(
      input.terrain.revision(),
      projectedRevision,
      "Terrain revision changed during initial projection build",
    );
  } catch (error) {
    disposeRegistryResources(root, registry);
    material.dispose();
    throw error;
  }

  const assertNotDisposed = (): void => {
    if (disposed) {
      throw new Error("Terrain Three.js projection has been disposed.");
    }
  };

  const projection: TerrainThreeProjection = {
    root,
    rebuild(changeSet) {
      assertNotDisposed();
      if (changeSet.previousRevision !== projectedRevision) {
        throw new Error(
          `Terrain projection previous revision mismatch: projected ${projectedRevision}, change set starts at ${changeSet.previousRevision}.`,
        );
      }

      assertCurrentRevision(
        input.terrain.revision(),
        changeSet.newRevision,
        "Terrain revision does not match TerrainChangeSet new revision",
      );

      const dirty = computeDirtyRenderSectors(layout, changeSet);
      if (dirty.length === 0) {
        if (changeSet.previousRevision === changeSet.newRevision) return;
        throw new Error(
          "Terrain revision advanced without dirty sectors in TerrainChangeSet.",
        );
      }

      const staged: SectorResource[] = [];
      try {
        for (const coord of dirty) {
          staged.push(
            buildSectorResource(coord, changeSet.newRevision, context),
          );
        }
        assertCurrentRevision(
          input.terrain.revision(),
          changeSet.newRevision,
          "Terrain revision changed during staged rebuild",
        );
      } catch (error) {
        for (const resource of staged) resource.dispose();
        throw error;
      }

      for (const replacement of staged) {
        const previous = registry.replace(replacement);
        root.remove(previous.mesh);
        root.add(replacement.mesh);
        previous.dispose();
      }
      projectedRevision = changeSet.newRevision;
    },
    pick(raycaster) {
      assertNotDisposed();
      return pickSemanticTerrain({
        raycaster,
        root,
        world: input.world,
        terrain: input.terrain,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeRegistryResources(root, registry);
      root.removeFromParent();
      material.dispose();
    },
  };

  return { status: "success", value: Object.freeze(projection) };
}
