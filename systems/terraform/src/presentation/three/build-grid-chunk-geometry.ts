import { logicalElevationToMeters } from "@web-three-city/terrain";
import type { TerrainAuthorityRead } from "@web-three-city/terrain";
import type {
  CellCoord,
  ChunkCoord,
  MapDefinitionRead,
  MapStateRead,
  VertexCoord,
  WorldSpatialRead,
} from "@web-three-city/world";

interface GridGeometryInput {
  readonly mapDefinition: MapDefinitionRead;
  readonly terrain: TerrainAuthorityRead;
  readonly surfaceOffsetMeters: number;
}

export interface TerraformLineData {
  readonly positions: Float32Array;
  readonly cellCount: number;
  readonly segmentCount: number;
}

interface EdgeRecord {
  readonly orientation: 0 | 1;
  readonly x: number;
  readonly z: number;
  readonly a: VertexCoord;
  readonly b: VertexCoord;
}

function cellKey(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function edgeKey(edge: EdgeRecord): string {
  return `${edge.orientation}:${edge.x}:${edge.z}`;
}

function isCellInsideWorld(
  mapDefinition: MapDefinitionRead,
  cell: CellCoord,
): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.z) &&
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < mapDefinition.widthCells &&
    cell.z < mapDefinition.heightCells
  );
}

function appendCellEdges(
  target: Map<string, EdgeRecord>,
  cell: CellCoord,
): void {
  const edges: readonly EdgeRecord[] = [
    {
      orientation: 0,
      x: cell.x,
      z: cell.z,
      a: { x: cell.x, z: cell.z },
      b: { x: cell.x + 1, z: cell.z },
    },
    {
      orientation: 0,
      x: cell.x,
      z: cell.z + 1,
      a: { x: cell.x, z: cell.z + 1 },
      b: { x: cell.x + 1, z: cell.z + 1 },
    },
    {
      orientation: 1,
      x: cell.x,
      z: cell.z,
      a: { x: cell.x, z: cell.z },
      b: { x: cell.x, z: cell.z + 1 },
    },
    {
      orientation: 1,
      x: cell.x + 1,
      z: cell.z,
      a: { x: cell.x + 1, z: cell.z },
      b: { x: cell.x + 1, z: cell.z + 1 },
    },
  ];
  for (const edge of edges) target.set(edgeKey(edge), edge);
}

function sortedEdges(
  edges: ReadonlyMap<string, EdgeRecord>,
): readonly EdgeRecord[] {
  return [...edges.values()].sort(
    (left, right) =>
      left.z - right.z ||
      left.x - right.x ||
      left.orientation - right.orientation,
  );
}

function buildLineDataFromCells(
  input: GridGeometryInput,
  cells: readonly CellCoord[],
): TerraformLineData {
  const uniqueCells = new Map<string, CellCoord>();
  for (const cell of cells) {
    if (isCellInsideWorld(input.mapDefinition, cell)) {
      uniqueCells.set(cellKey(cell), cell);
    }
  }

  const edges = new Map<string, EdgeRecord>();
  for (const cell of [...uniqueCells.values()].sort(
    (left, right) => left.z - right.z || left.x - right.x,
  )) {
    appendCellEdges(edges, cell);
  }

  const elevationMeters = new Map<string, number>();
  const readElevationMeters = (vertex: VertexCoord): number => {
    const key = `${vertex.x}:${vertex.z}`;
    const cached = elevationMeters.get(key);
    if (cached !== undefined) return cached;
    const result = input.terrain.elevationAt(vertex);
    if (result.status !== "success") {
      throw new Error(
        `Terraform overlay terrain elevation unavailable at vertex ${key}.`,
      );
    }
    const meters =
      logicalElevationToMeters(result.value) + input.surfaceOffsetMeters;
    elevationMeters.set(key, meters);
    return meters;
  };

  const positions: number[] = [];
  for (const edge of sortedEdges(edges)) {
    positions.push(
      edge.a.x * input.mapDefinition.cellSizeMeters,
      readElevationMeters(edge.a),
      edge.a.z * input.mapDefinition.cellSizeMeters,
      edge.b.x * input.mapDefinition.cellSizeMeters,
      readElevationMeters(edge.b),
      edge.b.z * input.mapDefinition.cellSizeMeters,
    );
  }

  return Object.freeze({
    positions: new Float32Array(positions),
    cellCount: uniqueCells.size,
    segmentCount: edges.size,
  });
}

export function buildTerraformGridChunkLineData(input: {
  readonly mapDefinition: MapDefinitionRead;
  readonly mapState: MapStateRead;
  readonly spatial: WorldSpatialRead;
  readonly terrain: TerrainAuthorityRead;
  readonly chunk: ChunkCoord;
  readonly surfaceOffsetMeters: number;
}): TerraformLineData {
  const { mapDefinition, chunk } = input;
  const chunkSize = mapDefinition.logicalChunkSizeCells;
  const xStart = chunk.x * chunkSize;
  const zStart = chunk.z * chunkSize;
  if (
    chunk.x < 0 ||
    chunk.z < 0 ||
    xStart >= mapDefinition.widthCells ||
    zStart >= mapDefinition.heightCells
  ) {
    return Object.freeze({
      positions: new Float32Array(),
      cellCount: 0,
      segmentCount: 0,
    });
  }
  const xEnd = Math.min(mapDefinition.widthCells, xStart + chunkSize);
  const zEnd = Math.min(mapDefinition.heightCells, zStart + chunkSize);
  const unlocked = new Set(input.mapState.unlockedRegionIds);
  const editableCells: CellCoord[] = [];

  for (let z = zStart; z < zEnd; z += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const cell = { x, z };
      const region = input.spatial.regionAtCell(cell);
      if (region.status !== "success") {
        throw new Error(
          `Terraform overlay region unavailable at cell ${cell.x}:${cell.z}.`,
        );
      }
      if (unlocked.has(region.value)) editableCells.push(cell);
    }
  }

  return buildLineDataFromCells(input, editableCells);
}

export function buildTerraformCellHighlightLineData(input: {
  readonly mapDefinition: MapDefinitionRead;
  readonly terrain: TerrainAuthorityRead;
  readonly cells: readonly CellCoord[];
  readonly surfaceOffsetMeters: number;
}): TerraformLineData {
  return buildLineDataFromCells(input, input.cells);
}
