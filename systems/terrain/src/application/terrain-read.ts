import type {
  CellCoord,
  VertexCoord,
  WorldSpatialRead,
} from "@web-three-city/world";
import type {
  CellSurfaceRead,
  SurfaceSampleRead,
  TerrainAuthorityRead,
  TerrainQueryResult,
  TerrainRevision,
} from "../contracts/terrain-read";
import type { LogicalElevation } from "../domain/elevation";
import { Q16_ONE, evaluateSurface } from "../domain/surface";
import type { TerrainState } from "../domain/terrain-state";
import {
  readTerrainElevation,
  terrainCompleteness,
} from "../domain/terrain-state";
import { toChunkKey, toVertexKey } from "./world-index";

export interface CreateTerrainAuthorityReadInput {
  readonly state: TerrainState;
  readonly world: WorldSpatialRead;
  readonly vertexWidth: number;
}

const OUT_OF_BOUNDS = {
  status: "out-of-bounds",
  code: "TERRAIN_QUERY_OUT_OF_BOUNDS",
} as const;

function isValidQ16(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= Q16_ONE;
}

export function createTerrainAuthorityRead(
  input: CreateTerrainAuthorityReadInput,
): TerrainAuthorityRead {
  const revision = () => input.state.revision as TerrainRevision;

  const elevationAt = (
    vertex: VertexCoord,
  ): TerrainQueryResult<LogicalElevation> => {
    const owner = input.world.ownerChunk(vertex);
    if (owner.status !== "success") {
      return OUT_OF_BOUNDS;
    }

    const elevation = readTerrainElevation(
      input.state,
      toChunkKey(owner.value),
      toVertexKey(vertex, input.vertexWidth),
    );
    if (elevation.status === "unavailable") {
      return {
        status: "unavailable",
        code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE",
        chunk: owner.value,
      };
    }

    return elevation;
  };

  const cellSurface = (
    cell: CellCoord,
  ): TerrainQueryResult<CellSurfaceRead> => {
    const bounds = input.world.cellBounds(cell);
    if (bounds.status !== "success") {
      return OUT_OF_BOUNDS;
    }

    const sw = elevationAt({ x: cell.x, z: cell.z });
    if (sw.status !== "success") return sw;

    const se = elevationAt({ x: cell.x + 1, z: cell.z });
    if (se.status !== "success") return se;

    const nw = elevationAt({ x: cell.x, z: cell.z + 1 });
    if (nw.status !== "success") return nw;

    const ne = elevationAt({ x: cell.x + 1, z: cell.z + 1 });
    if (ne.status !== "success") return ne;

    return {
      status: "success",
      value: {
        cell: { x: cell.x, z: cell.z },
        sw: sw.value,
        se: se.value,
        nw: nw.value,
        ne: ne.value,
        revision: revision(),
      },
    };
  };

  const sampleSurface = (
    cell: CellCoord,
    uQ16: number,
    vQ16: number,
  ): TerrainQueryResult<SurfaceSampleRead> => {
    if (!isValidQ16(uQ16) || !isValidQ16(vQ16)) {
      return OUT_OF_BOUNDS;
    }

    const surface = cellSurface(cell);
    if (surface.status !== "success") {
      return surface;
    }

    return {
      status: "success",
      value: {
        ...evaluateSurface(surface.value, uQ16, vQ16),
        revision: surface.value.revision,
      },
    };
  };

  return {
    revision,
    completeness() {
      return terrainCompleteness(input.state);
    },
    elevationAt,
    cellSurface,
    sampleSurface,
  };
}
