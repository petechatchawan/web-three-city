export interface ZoneMeshBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface ZoneMeshGroup {
  readonly start: number;
  readonly count: number;
  readonly materialIndex: number;
}

export interface ZoneMeshData {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly groups: readonly ZoneMeshGroup[];
  readonly cellCount: number;
  readonly bounds: ZoneMeshBounds | null;
}
