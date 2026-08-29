import { Group, type Material } from "three";
import type {
  CreateTerrainThreeDebugOverlayInput,
  TerrainDebugLayer,
  TerrainDebugVisibility,
  TerrainThreeDebugOverlay,
  TerrainThreeDebugOverlayConstructionResult,
} from "../../../contracts/terrain-debug";
import { readSectorSurface } from "../geometry/read-sector-surface";
import { computeDirtyRenderSectors } from "../topology/dirty-sectors";
import {
  allRenderSectorCoords,
  createRenderSectorLayout,
  renderSectorKey,
  type RenderSectorCoord,
} from "../topology/render-sector";
import { TERRAIN_DEBUG_DEFAULT_CONFIG } from "./debug-config";
import {
  createDebugLayerGroup,
  createDebugLayerMaterial,
  createDebugSectorResource,
  type TerrainDebugSectorResource,
} from "./debug-resource";

const LAYERS: readonly TerrainDebugLayer[] = Object.freeze([
  "cellGrid",
  "renderSectors",
  "vertices",
  "triangles",
  "normals",
  "elevation",
]);

interface LayerState {
  readonly group: Group;
  readonly material: Material;
  readonly resources: Map<string, TerrainDebugSectorResource>;
}

function frozenVisibility(
  value: TerrainDebugVisibility,
): TerrainDebugVisibility {
  return Object.freeze({ ...value });
}

export function createTerrainThreeDebugOverlayInternal(
  input: CreateTerrainThreeDebugOverlayInput,
): TerrainThreeDebugOverlayConstructionResult {
  if (input.terrain.completeness() !== "full") {
    return {
      status: "rejected",
      code: "TERRAIN_PRESENTATION_TERRAIN_INCOMPLETE",
    };
  }
  const config = input.config ?? TERRAIN_DEBUG_DEFAULT_CONFIG;
  const layout = createRenderSectorLayout(input.mapDefinition);
  const root = new Group();
  root.name = "terrain-debug-overlay";
  let projectedRevision = input.terrain.revision();
  let visibility = frozenVisibility(config.visibility);
  const layerStates = new Map<TerrainDebugLayer, LayerState>();
  let disposed = false;

  const assertUsable = (): void => {
    if (disposed) throw new Error("Terrain debug overlay is disposed.");
  };

  const buildResource = (
    layer: TerrainDebugLayer,
    state: LayerState,
    sector: RenderSectorCoord,
    expectedRevision: number,
    snapshot = readSectorSurface({ layout, sector, terrain: input.terrain }),
  ): TerrainDebugSectorResource => {
    if (snapshot.revision !== expectedRevision) {
      throw new Error("Terrain debug snapshot revision mismatch.");
    }
    return createDebugSectorResource({
      layer,
      layout,
      sector,
      snapshot,
      world: input.world,
      config,
      material: state.material,
    });
  };

  const disableLayer = (layer: TerrainDebugLayer): void => {
    const state = layerStates.get(layer);
    if (state === undefined) return;
    for (const resource of state.resources.values()) resource.dispose();
    state.resources.clear();
    root.remove(state.group);
    state.material.dispose();
    layerStates.delete(layer);
  };

  const enableLayers = (layers: readonly TerrainDebugLayer[]): void => {
    if (layers.length === 0) return;
    if (input.terrain.revision() !== projectedRevision) {
      throw new Error("Terrain debug overlay revision is stale.");
    }
    const stagedStates = new Map<TerrainDebugLayer, LayerState>();
    try {
      for (const layer of layers) {
        stagedStates.set(layer, {
          group: createDebugLayerGroup(layer),
          material: createDebugLayerMaterial(layer, config),
          resources: new Map(),
        });
      }
      for (const sector of allRenderSectorCoords(layout)) {
        const snapshot = readSectorSurface({
          layout,
          sector,
          terrain: input.terrain,
        });
        if (snapshot.revision !== projectedRevision)
          throw new Error("Terrain debug snapshot revision mismatch.");
        for (const [layer, state] of stagedStates) {
          const resource = buildResource(
            layer,
            state,
            sector,
            projectedRevision,
            snapshot,
          );
          state.resources.set(renderSectorKey(sector), resource);
          state.group.add(resource.object);
        }
      }
      if (input.terrain.revision() !== projectedRevision)
        throw new Error("Terrain debug overlay revision changed during build.");
      for (const [layer, state] of stagedStates) {
        layerStates.set(layer, state);
        root.add(state.group);
      }
    } catch (error) {
      for (const state of stagedStates.values()) {
        for (const resource of state.resources.values()) resource.dispose();
        state.material.dispose();
      }
      throw error;
    }
  };

  const value: TerrainThreeDebugOverlay = {
    root,
    visibility: () => visibility,
    setVisibility(next) {
      assertUsable();
      const target = frozenVisibility({ ...visibility, ...next });
      const disabling = LAYERS.filter(
        (layer) => visibility[layer] && !target[layer],
      );
      const enabling = LAYERS.filter(
        (layer) => !visibility[layer] && target[layer],
      );
      enableLayers(enabling);
      for (const layer of disabling) disableLayer(layer);
      visibility = target;
    },
    rebuild(changeSet) {
      assertUsable();
      if (
        changeSet.previousRevision !== projectedRevision ||
        changeSet.newRevision !== input.terrain.revision()
      ) {
        throw new Error(
          "Terrain debug overlay revision transition is invalid.",
        );
      }
      const dirty = computeDirtyRenderSectors(layout, changeSet);
      const staged: Array<{
        layer: TerrainDebugLayer;
        sector: RenderSectorCoord;
        resource: TerrainDebugSectorResource;
      }> = [];
      try {
        for (const sector of dirty) {
          const snapshot = readSectorSurface({
            layout,
            sector,
            terrain: input.terrain,
          });
          if (snapshot.revision !== changeSet.newRevision)
            throw new Error("Terrain debug snapshot revision mismatch.");
          for (const [layer, state] of layerStates) {
            staged.push({
              layer,
              sector,
              resource: buildResource(
                layer,
                state,
                sector,
                changeSet.newRevision,
                snapshot,
              ),
            });
          }
        }
        if (input.terrain.revision() !== changeSet.newRevision)
          throw new Error("Terrain debug revision changed during rebuild.");
        for (const replacement of staged) {
          const state = layerStates.get(replacement.layer)!;
          const key = renderSectorKey(replacement.sector);
          const old = state.resources.get(key);
          if (old !== undefined) {
            state.group.remove(old.object);
            old.dispose();
          }
          state.resources.set(key, replacement.resource);
          state.group.add(replacement.resource.object);
        }
        projectedRevision = changeSet.newRevision;
      } catch (error) {
        for (const replacement of staged) replacement.resource.dispose();
        throw error;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const layer of [...layerStates.keys()]) disableLayer(layer);
      root.clear();
    },
  };
  return { status: "success", value };
}
