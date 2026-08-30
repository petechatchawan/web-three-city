import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  type Object3D,
} from "three";
import type {
  TerrainDebugConfig,
  TerrainDebugLayer,
} from "../../../contracts/terrain-debug";
import type { SectorSurfaceSnapshot } from "../geometry/read-sector-surface";
import type {
  RenderSectorCoord,
  RenderSectorLayout,
} from "../topology/render-sector";
import type { WorldSpatialRead } from "@web-three-city/world";
import {
  buildCellGridLineData,
  buildElevationData,
  buildNormalLineData,
  buildSectorBoundaryLineData,
  buildTriangleLineData,
  buildVertexPointData,
} from "./debug-geometry";

const POSITION_COMPONENTS = 3;
const DEBUG_COLORS: Readonly<Record<TerrainDebugLayer, number>> = Object.freeze(
  {
    cellGrid: 0xd8e2ea,
    renderSectors: 0xffb454,
    vertices: 0xf8fafc,
    triangles: 0x5eead4,
    normals: 0xf472b6,
    elevation: 0xffffff,
  },
);

export interface TerrainDebugSectorResource {
  readonly object: Object3D;
  readonly geometry: BufferGeometry;
  dispose(): void;
}

export function createDebugLayerGroup(layer: TerrainDebugLayer): Group {
  const group = new Group();
  group.name = `terrain-debug-layer:${layer}`;
  return group;
}

export function createDebugLayerMaterial(
  layer: TerrainDebugLayer,
  config: TerrainDebugConfig,
): Material {
  if (layer === "vertices") {
    return new PointsMaterial({
      color: DEBUG_COLORS[layer],
      size: config.pointSizePixels,
      sizeAttenuation: false,
    });
  }
  if (layer === "elevation") {
    return new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: config.elevationOpacity,
      side: DoubleSide,
    });
  }
  return new LineBasicMaterial({
    color: DEBUG_COLORS[layer],
    transparent: true,
    opacity: config.lineOpacity,
  });
}

function geometryFromPositions(positions: Float32Array): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(positions, POSITION_COMPONENTS),
  );
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildLinePositions(input: {
  readonly layer: TerrainDebugLayer;
  readonly layout: RenderSectorLayout;
  readonly sector: RenderSectorCoord;
  readonly snapshot: SectorSurfaceSnapshot;
  readonly world: WorldSpatialRead;
  readonly config: TerrainDebugConfig;
}): Float32Array {
  switch (input.layer) {
    case "cellGrid":
      return buildCellGridLineData(input).positions;
    case "renderSectors":
      return buildSectorBoundaryLineData(input).positions;
    case "triangles":
      return buildTriangleLineData(input).positions;
    default:
      return buildNormalLineData(input).positions;
  }
}

export function createDebugSectorResource(input: {
  readonly layer: TerrainDebugLayer;
  readonly layout: RenderSectorLayout;
  readonly sector: RenderSectorCoord;
  readonly snapshot: SectorSurfaceSnapshot;
  readonly world: WorldSpatialRead;
  readonly config: TerrainDebugConfig;
  readonly material: Material;
}): TerrainDebugSectorResource {
  let geometry: BufferGeometry;
  let object: Object3D;
  if (input.layer === "elevation") {
    const data = buildElevationData(input);
    geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(data.positions, POSITION_COMPONENTS),
    );
    geometry.setAttribute(
      "normal",
      new BufferAttribute(data.normals, POSITION_COMPONENTS),
    );
    geometry.setAttribute(
      "color",
      new BufferAttribute(data.colors, POSITION_COMPONENTS),
    );
    geometry.setIndex(new BufferAttribute(data.indices, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    object = new Mesh(geometry, input.material);
  } else if (input.layer === "vertices") {
    geometry = geometryFromPositions(buildVertexPointData(input).positions);
    object = new Points(geometry, input.material);
  } else {
    geometry = geometryFromPositions(buildLinePositions(input));
    object = new LineSegments(geometry, input.material);
  }
  object.name = `terrain-debug:${input.layer}:${input.sector.x}:${input.sector.z}`;
  let disposed = false;
  return Object.freeze({
    object,
    geometry,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
    },
  });
}
