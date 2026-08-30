import type {
  CellCoord,
  MapDefinitionRead,
  MapStateRead,
  VertexCoord,
  WorldSpatialRead,
} from "@web-three-city/world";
import type {
  LogicalElevation,
  TerrainAuthorityRead,
} from "@web-three-city/terrain";

export interface FlattenReferencePick {
  readonly cell: CellCoord;
  readonly uQ16: number;
  readonly vQ16: number;
}

export type FlattenReferenceRejectionReason =
  | "OUT_OF_WORLD"
  | "LOCKED_REGION"
  | "TERRAIN_UNAVAILABLE";

export type FlattenReferenceResult =
  | {
      readonly status: "success";
      readonly value: LogicalElevation;
      readonly vertex: VertexCoord;
    }
  | {
      readonly status: "rejected";
      readonly reason: FlattenReferenceRejectionReason;
    };

export interface SelectFlattenReferenceInput {
  readonly pick: FlattenReferencePick;
  readonly mapDefinition: MapDefinitionRead;
  readonly mapState: MapStateRead;
  readonly spatial: WorldSpatialRead;
  readonly terrain: TerrainAuthorityRead;
}

export function resolveFlattenCorner(pick: FlattenReferencePick): VertexCoord {
  return Object.freeze({
    x: pick.cell.x + (pick.uQ16 >= 32768 ? 1 : 0),
    z: pick.cell.z + (pick.vQ16 >= 32768 ? 1 : 0),
  });
}

function isCellInWorld(
  cell: CellCoord,
  mapDefinition: MapDefinitionRead,
): boolean {
  return (
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < mapDefinition.widthCells &&
    cell.z < mapDefinition.heightCells
  );
}

export function selectFlattenReference(
  input: SelectFlattenReferenceInput,
): FlattenReferenceResult {
  if (!isCellInWorld(input.pick.cell, input.mapDefinition)) {
    return Object.freeze({
      status: "rejected" as const,
      reason: "OUT_OF_WORLD" as const,
    });
  }

  const region = input.spatial.regionAtCell(input.pick.cell);
  if (
    region.status !== "success" ||
    !input.mapState.unlockedRegionIds.includes(region.value)
  ) {
    return Object.freeze({
      status: "rejected" as const,
      reason: "LOCKED_REGION" as const,
    });
  }

  const vertex = resolveFlattenCorner(input.pick);
  const elevation = input.terrain.elevationAt(vertex);
  if (elevation.status !== "success") {
    return Object.freeze({
      status: "rejected" as const,
      reason: "TERRAIN_UNAVAILABLE" as const,
    });
  }

  return Object.freeze({
    status: "success" as const,
    value: elevation.value,
    vertex,
  });
}
