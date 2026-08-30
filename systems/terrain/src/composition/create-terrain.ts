import type {
  CreateTerrainThreeProjectionInput,
  TerrainThreeProjectionConstructionResult,
} from "../contracts/terrain-three";
import type {
  CreateTerrainAuthorityInput,
  RestoreTerrainInput,
  TerrainAuthoritySystem,
  TerrainConstructionResult,
  TerrainSystem,
} from "../contracts/terrain-composition";
import type { TerrainAuthorityRead } from "../contracts/terrain-read";
import { applyTerrainEdits } from "../application/apply-terrain-edits";
import { captureTerrainSnapshot } from "../application/capture-terrain-snapshot";
import { createTerrainAuthorityRead } from "../application/terrain-read";
import { materializeTerrain } from "../application/materialize-terrain";
import { restoreTerrain } from "../application/restore-terrain";
import { TERRAIN_VERTEX_AXIS_COUNT } from "../application/world-index";
import type { TerrainState } from "../domain/terrain-state";
import { createTerrainThreeProjectionInternal } from "../presentation/three/projection/terrain-projection";
import { createTerrainThreeDebugOverlayInternal } from "../presentation/three/debug/terrain-debug-overlay";
import type {
  CreateTerrainThreeDebugOverlayInput,
  TerrainThreeDebugOverlayConstructionResult,
} from "../contracts/terrain-debug";

function createLiveTerrainRead(
  state: () => TerrainState,
  world: CreateTerrainAuthorityInput["world"],
): TerrainAuthorityRead {
  const current = () =>
    createTerrainAuthorityRead({
      state: state(),
      world,
      vertexWidth: TERRAIN_VERTEX_AXIS_COUNT,
    });

  return {
    revision: () => current().revision(),
    completeness: () => current().completeness(),
    elevationAt: (vertex) => current().elevationAt(vertex),
    cellSurface: (cell) => current().cellSurface(cell),
    sampleSurface: (cell, uQ16, vQ16) =>
      current().sampleSurface(cell, uQ16, vQ16),
  };
}

export function createTerrainAuthorityInternal(
  input: CreateTerrainAuthorityInput,
): TerrainConstructionResult<TerrainAuthoritySystem> {
  const materialized = materializeTerrain(input);
  if (materialized.status === "rejected") return materialized;

  return {
    status: "success",
    value: {
      read: createTerrainAuthorityRead({
        state: materialized.value,
        world: input.world,
        vertexWidth: TERRAIN_VERTEX_AXIS_COUNT,
      }),
    },
  };
}

function createTerrainSystemFromState(
  initialState: TerrainState,
  world: CreateTerrainAuthorityInput["world"],
): TerrainSystem {
  let state = initialState;
  const read = createLiveTerrainRead(() => state, world);
  return {
    read,
    commands: {
      applyEdits(command) {
        const outcome = applyTerrainEdits({ state, world, command });
        state = outcome.state;
        return outcome.result;
      },
    },
    captureSnapshot() {
      return captureTerrainSnapshot(state);
    },
  };
}

export function createTerrainSystemInternal(
  input: CreateTerrainAuthorityInput,
): TerrainConstructionResult<TerrainSystem> {
  const materialized = materializeTerrain(input);
  if (materialized.status === "rejected") return materialized;

  return {
    status: "success",
    value: createTerrainSystemFromState(materialized.value, input.world),
  };
}

export function restoreTerrainSystemInternal(
  input: RestoreTerrainInput,
): TerrainConstructionResult<TerrainSystem> {
  const restored = restoreTerrain(input);
  if (restored.status === "rejected") return restored;
  return {
    status: "success",
    value: createTerrainSystemFromState(restored.value, input.world),
  };
}

export function createTerrainThreeProjectionCompositionInternal(
  input: CreateTerrainThreeProjectionInput,
): TerrainThreeProjectionConstructionResult {
  return createTerrainThreeProjectionInternal(input);
}

export function createTerrainThreeDebugOverlayCompositionInternal(
  input: CreateTerrainThreeDebugOverlayInput,
): TerrainThreeDebugOverlayConstructionResult {
  return createTerrainThreeDebugOverlayInternal(input);
}
