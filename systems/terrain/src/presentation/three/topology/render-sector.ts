import type {
  CellCoord,
  CellRect,
  MapDefinitionRead,
} from "@web-three-city/world";

export const RENDER_SECTOR_CELLS = 64 as const;

export interface RenderSectorCoord {
  readonly x: number;
  readonly z: number;
}

export interface RenderSectorLayout {
  readonly widthCells: number;
  readonly heightCells: number;
  readonly cellSizeMeters: number;
  readonly cellsPerSector: typeof RENDER_SECTOR_CELLS;
  readonly sectorCountX: number;
  readonly sectorCountZ: number;
  readonly totalSectors: number;
  readonly vertexAxisCount: number;
}

export function createRenderSectorLayout(
  mapDefinition: Pick<
    MapDefinitionRead,
    "widthCells" | "heightCells" | "cellSizeMeters"
  >,
): RenderSectorLayout {
  if (
    mapDefinition.widthCells % RENDER_SECTOR_CELLS !== 0 ||
    mapDefinition.heightCells % RENDER_SECTOR_CELLS !== 0
  ) {
    throw new Error(
      "Render-sector layout requires map dimensions divisible by RENDER_SECTOR_CELLS.",
    );
  }

  const sectorCountX = mapDefinition.widthCells / RENDER_SECTOR_CELLS;
  const sectorCountZ = mapDefinition.heightCells / RENDER_SECTOR_CELLS;

  return Object.freeze({
    widthCells: mapDefinition.widthCells,
    heightCells: mapDefinition.heightCells,
    cellSizeMeters: mapDefinition.cellSizeMeters,
    cellsPerSector: RENDER_SECTOR_CELLS,
    sectorCountX,
    sectorCountZ,
    totalSectors: sectorCountX * sectorCountZ,
    vertexAxisCount: RENDER_SECTOR_CELLS + 1,
  });
}

function isValidCell(layout: RenderSectorLayout, cell: CellCoord): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.z) &&
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < layout.widthCells &&
    cell.z < layout.heightCells
  );
}

function isValidSector(
  layout: RenderSectorLayout,
  sector: RenderSectorCoord,
): boolean {
  return (
    Number.isInteger(sector.x) &&
    Number.isInteger(sector.z) &&
    sector.x >= 0 &&
    sector.z >= 0 &&
    sector.x < layout.sectorCountX &&
    sector.z < layout.sectorCountZ
  );
}

export function allRenderSectorCoords(
  layout: RenderSectorLayout,
): readonly RenderSectorCoord[] {
  const sectors: RenderSectorCoord[] = [];
  for (let z = 0; z < layout.sectorCountZ; z += 1) {
    for (let x = 0; x < layout.sectorCountX; x += 1) {
      sectors.push(Object.freeze({ x, z }));
    }
  }
  return Object.freeze(sectors);
}

export function renderSectorForCell(
  layout: RenderSectorLayout,
  cell: CellCoord,
): RenderSectorCoord | undefined {
  if (!isValidCell(layout, cell)) return undefined;
  return Object.freeze({
    x: Math.floor(cell.x / layout.cellsPerSector),
    z: Math.floor(cell.z / layout.cellsPerSector),
  });
}

export function renderSectorCellBounds(
  layout: RenderSectorLayout,
  sector: RenderSectorCoord,
): CellRect {
  if (!isValidSector(layout, sector)) {
    throw new Error("Render sector coordinate is outside the layout.");
  }

  const xStartInclusive = sector.x * layout.cellsPerSector;
  const zStartInclusive = sector.z * layout.cellsPerSector;
  return Object.freeze({
    xStartInclusive,
    zStartInclusive,
    xEndExclusive: xStartInclusive + layout.cellsPerSector,
    zEndExclusive: zStartInclusive + layout.cellsPerSector,
  });
}

export function renderSectorKey(coord: RenderSectorCoord): string {
  return `${coord.z}:${coord.x}`;
}

export function compareRenderSectorCoord(
  left: RenderSectorCoord,
  right: RenderSectorCoord,
): number {
  return left.z - right.z || left.x - right.x;
}
