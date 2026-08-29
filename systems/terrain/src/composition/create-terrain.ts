import type {
  CreateTerrainAuthorityInput,
  TerrainAuthoritySystem,
  TerrainConstructionResult,
  TerrainSystem,
} from "../contracts/terrain-composition";
import type { TerrainAuthorityRead } from "../contracts/terrain-read";
import { applyTerrainEdits } from "../application/apply-terrain-edits";
import { createTerrainAuthorityRead } from "../application/terrain-read";
import { materializeTerrain } from "../application/materialize-terrain";
import { TERRAIN_VERTEX_AXIS_COUNT } from "../application/world-index";
import type { TerrainState } from "../domain/terrain-state";

function createLiveTerrainRead(
  state: () => TerrainState,
  input: CreateTerrainAuthorityInput,
): TerrainAuthorityRead {
  const current = () =>
    createTerrainAuthorityRead({
      state: state(),
      world: input.world,
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

export function createTerrainSystemInternal(
  input: CreateTerrainAuthorityInput,
): TerrainConstructionResult<TerrainSystem> {
  const materialized = materializeTerrain(input);
  if (materialized.status === "rejected") return materialized;

  let state = materialized.value;
  const read = createLiveTerrainRead(() => state, input);

  return {
    status: "success",
    value: {
      read,
      commands: {
        applyEdits(command) {
          const outcome = applyTerrainEdits({
            state,
            world: input.world,
            command,
          });
          state = outcome.state;
          return outcome.result;
        },
      },
    },
  };
}
