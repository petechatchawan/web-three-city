import type { VertexCoord, WorldSpatialRead } from "@web-three-city/world";
import { logicalElevationToMeters } from "../../../domain/elevation";
import type { TerrainDebugConfig } from "../../../contracts/terrain-debug";
import type { SectorSurfaceSnapshot } from "../geometry/read-sector-surface";
import { buildSectorGeometryData } from "../geometry/build-sector-geometry";
import { computePresentationNormal } from "../geometry/presentation-normal";
import type {
  RenderSectorCoord,
  RenderSectorLayout,
} from "../topology/render-sector";

const COMPONENTS = 3;
const LOW_COLOR = [0.16, 0.36, 0.66] as const;
const HIGH_COLOR = [0.85, 0.72, 0.24] as const;

export interface DebugLineData {
  readonly positions: Float32Array;
}
export interface DebugPointData {
  readonly positions: Float32Array;
}
export interface DebugElevationData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint16Array;
  readonly colors: Float32Array;
}

function appendVertex(
  target: number[],
  snapshot: SectorSurfaceSnapshot,
  layout: RenderSectorLayout,
  x: number,
  z: number,
  offsetMeters: number,
): void {
  target.push(
    x * layout.cellSizeMeters,
    logicalElevationToMeters(snapshot.elevationAt({ x, z })) + offsetMeters,
    z * layout.cellSizeMeters,
  );
}

export function buildCellGridLineData(input: {
  readonly layout: RenderSectorLayout;
  readonly sector: RenderSectorCoord;
  readonly snapshot: SectorSurfaceSnapshot;
  readonly config: TerrainDebugConfig;
}): DebugLineData {
  const positions: number[] = [];
  const bounds = input.snapshot.visibleVertices;
  for (let z = bounds.zStartInclusive; z <= bounds.zEndInclusive; z += 1) {
    for (let x = bounds.xStartInclusive; x < bounds.xEndInclusive; x += 1) {
      appendVertex(
        positions,
        input.snapshot,
        input.layout,
        x,
        z,
        input.config.surfaceOffsetMeters,
      );
      appendVertex(
        positions,
        input.snapshot,
        input.layout,
        x + 1,
        z,
        input.config.surfaceOffsetMeters,
      );
    }
  }
  for (let x = bounds.xStartInclusive; x <= bounds.xEndInclusive; x += 1) {
    for (let z = bounds.zStartInclusive; z < bounds.zEndInclusive; z += 1) {
      appendVertex(
        positions,
        input.snapshot,
        input.layout,
        x,
        z,
        input.config.surfaceOffsetMeters,
      );
      appendVertex(
        positions,
        input.snapshot,
        input.layout,
        x,
        z + 1,
        input.config.surfaceOffsetMeters,
      );
    }
  }
  return Object.freeze({ positions: new Float32Array(positions) });
}

export function buildSectorBoundaryLineData(input: {
  readonly layout: RenderSectorLayout;
  readonly snapshot: SectorSurfaceSnapshot;
  readonly config: TerrainDebugConfig;
}): DebugLineData {
  const positions: number[] = [];
  const b = input.snapshot.visibleVertices;
  for (let x = b.xStartInclusive; x < b.xEndInclusive; x += 1) {
    for (const z of [b.zStartInclusive, b.zEndInclusive]) {
      appendVertex(
        positions,
        input.snapshot,
        input.layout,
        x,
        z,
        input.config.surfaceOffsetMeters * 2,
      );
      appendVertex(
        positions,
        input.snapshot,
        input.layout,
        x + 1,
        z,
        input.config.surfaceOffsetMeters * 2,
      );
    }
  }
  for (let z = b.zStartInclusive; z < b.zEndInclusive; z += 1) {
    for (const x of [b.xStartInclusive, b.xEndInclusive]) {
      appendVertex(
        positions,
        input.snapshot,
        input.layout,
        x,
        z,
        input.config.surfaceOffsetMeters * 2,
      );
      appendVertex(
        positions,
        input.snapshot,
        input.layout,
        x,
        z + 1,
        input.config.surfaceOffsetMeters * 2,
      );
    }
  }
  return Object.freeze({ positions: new Float32Array(positions) });
}

export function buildVertexPointData(input: {
  readonly layout: RenderSectorLayout;
  readonly snapshot: SectorSurfaceSnapshot;
  readonly config: TerrainDebugConfig;
}): DebugPointData {
  const positions: number[] = [];
  const b = input.snapshot.visibleVertices;
  for (let z = b.zStartInclusive; z <= b.zEndInclusive; z += 1) {
    for (let x = b.xStartInclusive; x <= b.xEndInclusive; x += 1) {
      appendVertex(
        positions,
        input.snapshot,
        input.layout,
        x,
        z,
        input.config.surfaceOffsetMeters * 3,
      );
    }
  }
  return Object.freeze({ positions: new Float32Array(positions) });
}

export function buildTriangleLineData(input: {
  readonly layout: RenderSectorLayout;
  readonly sector: RenderSectorCoord;
  readonly snapshot: SectorSurfaceSnapshot;
  readonly world: WorldSpatialRead;
  readonly config: TerrainDebugConfig;
}): DebugLineData {
  const geometry = buildSectorGeometryData(input);
  const positions: number[] = [];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 0],
  ] as const;
  for (let index = 0; index < geometry.indices.length; index += 3) {
    for (const [aOffset, bOffset] of edges) {
      const a = geometry.indices[index + aOffset];
      const b = geometry.indices[index + bOffset];
      if (a === undefined || b === undefined) continue;
      for (const vertexIndex of [a, b]) {
        const base = vertexIndex * COMPONENTS;
        positions.push(
          geometry.positions[base]!,
          geometry.positions[base + 1]! + input.config.surfaceOffsetMeters * 4,
          geometry.positions[base + 2]!,
        );
      }
    }
  }
  return Object.freeze({ positions: new Float32Array(positions) });
}

export function buildNormalLineData(input: {
  readonly layout: RenderSectorLayout;
  readonly snapshot: SectorSurfaceSnapshot;
  readonly world: WorldSpatialRead;
  readonly config: TerrainDebugConfig;
}): DebugLineData {
  const positions: number[] = [];
  const b = input.snapshot.visibleVertices;
  const stride = Math.max(1, Math.trunc(input.config.normalSampleStrideCells));
  for (let z = b.zStartInclusive; z <= b.zEndInclusive; z += stride) {
    for (let x = b.xStartInclusive; x <= b.xEndInclusive; x += stride) {
      const vertex: VertexCoord = { x, z };
      const y = logicalElevationToMeters(input.snapshot.elevationAt(vertex));
      const normal = computePresentationNormal({
        snapshot: input.snapshot,
        world: input.world,
        vertex,
        cellSizeMeters: input.layout.cellSizeMeters,
      });
      const startY = y + input.config.surfaceOffsetMeters;
      positions.push(
        x * input.layout.cellSizeMeters,
        startY,
        z * input.layout.cellSizeMeters,
      );
      positions.push(
        x * input.layout.cellSizeMeters +
          normal.x * input.config.normalLengthMeters,
        startY + normal.y * input.config.normalLengthMeters,
        z * input.layout.cellSizeMeters +
          normal.z * input.config.normalLengthMeters,
      );
    }
  }
  return Object.freeze({ positions: new Float32Array(positions) });
}

function mix(left: number, right: number, t: number): number {
  return left + (right - left) * t;
}

export function buildElevationData(input: {
  readonly layout: RenderSectorLayout;
  readonly sector: RenderSectorCoord;
  readonly snapshot: SectorSurfaceSnapshot;
  readonly world: WorldSpatialRead;
  readonly config: TerrainDebugConfig;
}): DebugElevationData {
  const geometry = buildSectorGeometryData(input);
  const colors = new Float32Array(geometry.positions.length);
  const span = Math.max(
    1,
    input.config.elevationMaxLogical - input.config.elevationMinLogical,
  );
  const b = input.snapshot.visibleVertices;
  let vertexIndex = 0;
  for (let z = b.zStartInclusive; z <= b.zEndInclusive; z += 1) {
    for (let x = b.xStartInclusive; x <= b.xEndInclusive; x += 1) {
      const elevation = input.snapshot.elevationAt({ x, z });
      const t = Math.min(
        1,
        Math.max(0, (elevation - input.config.elevationMinLogical) / span),
      );
      const offset = vertexIndex * COMPONENTS;
      colors[offset] = mix(LOW_COLOR[0], HIGH_COLOR[0], t);
      colors[offset + 1] = mix(LOW_COLOR[1], HIGH_COLOR[1], t);
      colors[offset + 2] = mix(LOW_COLOR[2], HIGH_COLOR[2], t);
      const currentY = geometry.positions[offset + 1];
      if (currentY === undefined) {
        throw new Error("Terrain debug elevation position invariant failed.");
      }
      geometry.positions[offset + 1] =
        currentY + input.config.surfaceOffsetMeters * 0.5;
      vertexIndex += 1;
    }
  }
  return Object.freeze({ ...geometry, colors });
}
