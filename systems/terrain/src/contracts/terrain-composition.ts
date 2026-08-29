import type { WorldSpatialRead } from "@web-three-city/world";
import type { TerrainAuthorityRead } from "./terrain-read";

export interface TerrainFieldSource {
  readonly vertexWidth: number;
  readonly vertexHeight: number;
  elevationAt(x: number, z: number): number;
}

export interface CreateTerrainAuthorityInput {
  readonly world: WorldSpatialRead;
  readonly mapDefinitionId: string;
  readonly generationProfileId: string;
  readonly generationProfileVersion: number;
  readonly selectedSeed64: string;
  readonly source: TerrainFieldSource;
}

export type TerrainConstructionResult<T> =
  | { readonly status: "success"; readonly value: T }
  | {
      readonly status: "rejected";
      readonly reason:
        | "invalid-source-dimensions"
        | "invalid-elevation"
        | "world-topology-rejected";
      readonly detail?: Readonly<Record<string, unknown>>;
    };

export interface TerrainAuthoritySystem {
  readonly read: TerrainAuthorityRead;
}
