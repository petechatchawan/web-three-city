import {
  ROAD_EAST,
  ROAD_NORTH,
  ROAD_SOUTH,
  ROAD_WEST,
  type RoadCellView,
} from '@web-three-city/road-core';
import type { WorldConfig } from '@web-three-city/world-core';
import {
  createRoadMeshData,
  emptyRoadMeshData,
  type RoadMeshData,
} from './road-mesh-data.js';

interface RoadRectangle {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

interface MutableRoadMesh {
  readonly positions: number[];
  readonly normals: number[];
  readonly colors: number[];
  readonly indices: number[];
}

const ROAD_COLOR = Object.freeze({ r: 0.24, g: 0.26, b: 0.29 });

function levelAt(view: RoadCellView, worldX: number, worldZ: number, config: WorldConfig): number {
  const cellMinX = view.cell.x * config.cellSize;
  const cellMinZ = view.cell.z * config.cellSize;
  const u = (worldX - cellMinX) / config.cellSize;
  const v = (worldZ - cellMinZ) / config.cellSize;
  const { nw, ne, sw, se } = view.surface.corners;
  return (
    nw * (1 - u) * (1 - v) +
    ne * u * (1 - v) +
    sw * (1 - u) * v +
    se * u * v
  );
}

function positionAt(
  view: RoadCellView,
  worldX: number,
  worldZ: number,
  config: WorldConfig,
): readonly [number, number, number] {
  return Object.freeze([
    worldX,
    levelAt(view, worldX, worldZ, config) * config.heightStep + view.definition.surfaceOffset,
    worldZ,
  ]);
}

function normalFor(
  first: readonly [number, number, number],
  second: readonly [number, number, number],
  third: readonly [number, number, number],
): readonly [number, number, number] {
  const ax = second[0] - first[0];
  const ay = second[1] - first[1];
  const az = second[2] - first[2];
  const bx = third[0] - first[0];
  const by = third[1] - first[1];
  const bz = third[2] - first[2];
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  const length = Math.hypot(nx, ny, nz);
  if (!Number.isFinite(length) || length <= 0) return Object.freeze([0, 1, 0]);
  return Object.freeze([nx / length, ny / length, nz / length]);
}

function appendRectangle(
  target: MutableRoadMesh,
  rectangle: RoadRectangle,
  view: RoadCellView,
  config: WorldConfig,
): void {
  if (rectangle.maxX <= rectangle.minX || rectangle.maxZ <= rectangle.minZ) return;
  const vertices = [
    positionAt(view, rectangle.minX, rectangle.minZ, config),
    positionAt(view, rectangle.maxX, rectangle.minZ, config),
    positionAt(view, rectangle.maxX, rectangle.maxZ, config),
    positionAt(view, rectangle.minX, rectangle.maxZ, config),
  ] as const;
  const normal = normalFor(vertices[0], vertices[3], vertices[2]);
  const base = target.positions.length / 3;
  for (const vertex of vertices) {
    target.positions.push(vertex[0], vertex[1], vertex[2]);
    target.normals.push(normal[0], normal[1], normal[2]);
    target.colors.push(ROAD_COLOR.r, ROAD_COLOR.g, ROAD_COLOR.b);
  }
  target.indices.push(base, base + 3, base + 2, base, base + 2, base + 1);
}

function roadRectangles(view: RoadCellView, config: WorldConfig): readonly RoadRectangle[] {
  const cellMinX = view.cell.x * config.cellSize;
  const cellMinZ = view.cell.z * config.cellSize;
  const cellMaxX = cellMinX + config.cellSize;
  const cellMaxZ = cellMinZ + config.cellSize;
  const width = Math.min(Math.max(view.definition.width, 0), config.cellSize);
  const inset = (config.cellSize - width) / 2;
  const centerMinX = cellMinX + inset;
  const centerMaxX = cellMaxX - inset;
  const centerMinZ = cellMinZ + inset;
  const centerMaxZ = cellMaxZ - inset;
  const rectangles: RoadRectangle[] = [
    { minX: centerMinX, maxX: centerMaxX, minZ: centerMinZ, maxZ: centerMaxZ },
  ];

  if ((view.connections & ROAD_NORTH) !== 0) {
    rectangles.push({
      minX: centerMinX,
      maxX: centerMaxX,
      minZ: cellMinZ,
      maxZ: centerMinZ,
    });
  }
  if ((view.connections & ROAD_EAST) !== 0) {
    rectangles.push({
      minX: centerMaxX,
      maxX: cellMaxX,
      minZ: centerMinZ,
      maxZ: centerMaxZ,
    });
  }
  if ((view.connections & ROAD_SOUTH) !== 0) {
    rectangles.push({
      minX: centerMinX,
      maxX: centerMaxX,
      minZ: centerMaxZ,
      maxZ: cellMaxZ,
    });
  }
  if ((view.connections & ROAD_WEST) !== 0) {
    rectangles.push({
      minX: cellMinX,
      maxX: centerMinX,
      minZ: centerMinZ,
      maxZ: centerMaxZ,
    });
  }
  return Object.freeze(rectangles.map((rectangle) => Object.freeze(rectangle)));
}

export function buildRoadCellMesh(view: RoadCellView, config: WorldConfig): RoadMeshData {
  const mutable: MutableRoadMesh = {
    positions: [],
    normals: [],
    colors: [],
    indices: [],
  };
  for (const rectangle of roadRectangles(view, config)) {
    appendRectangle(mutable, rectangle, view, config);
  }
  return createRoadMeshData({
    positions: new Float32Array(mutable.positions),
    normals: new Float32Array(mutable.normals),
    colors: new Float32Array(mutable.colors),
    indices: new Uint32Array(mutable.indices),
  });
}

export function mergeRoadCellMeshes(cells: readonly RoadMeshData[]): RoadMeshData {
  if (cells.length === 0) return emptyRoadMeshData();
  const positionLength = cells.reduce((sum, mesh) => sum + mesh.positions.length, 0);
  const normalLength = cells.reduce((sum, mesh) => sum + mesh.normals.length, 0);
  const colorLength = cells.reduce((sum, mesh) => sum + mesh.colors.length, 0);
  const indexLength = cells.reduce((sum, mesh) => sum + mesh.indices.length, 0);
  const positions = new Float32Array(positionLength);
  const normals = new Float32Array(normalLength);
  const colors = new Float32Array(colorLength);
  const indices = new Uint32Array(indexLength);
  let positionOffset = 0;
  let normalOffset = 0;
  let colorOffset = 0;
  let indexOffset = 0;
  let vertexOffset = 0;

  for (const mesh of cells) {
    positions.set(mesh.positions, positionOffset);
    normals.set(mesh.normals, normalOffset);
    colors.set(mesh.colors, colorOffset);
    for (let index = 0; index < mesh.indices.length; index += 1) {
      indices[indexOffset + index] = mesh.indices[index]! + vertexOffset;
    }
    positionOffset += mesh.positions.length;
    normalOffset += mesh.normals.length;
    colorOffset += mesh.colors.length;
    indexOffset += mesh.indices.length;
    vertexOffset += mesh.positions.length / 3;
  }

  return createRoadMeshData({ positions, normals, colors, indices });
}
