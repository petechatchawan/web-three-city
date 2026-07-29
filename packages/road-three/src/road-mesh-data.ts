export interface RoadMeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
  readonly triangleCount: number;
  readonly estimatedGeometryBytes: number;
}

export function createRoadMeshData(input: {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
}): RoadMeshData {
  return Object.freeze({
    ...input,
    triangleCount: input.indices.length / 3,
    estimatedGeometryBytes:
      input.positions.byteLength +
      input.normals.byteLength +
      input.colors.byteLength +
      input.indices.byteLength,
  });
}

export function emptyRoadMeshData(): RoadMeshData {
  return createRoadMeshData({
    positions: new Float32Array(),
    normals: new Float32Array(),
    colors: new Float32Array(),
    indices: new Uint32Array(),
  });
}
