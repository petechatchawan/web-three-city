import type {
  MapDefinitionRead,
  MapStateRead,
  WorldSpatialRead,
} from "@web-three-city/world";
import type { TerrainAuthorityRead } from "@web-three-city/terrain";
import type { Group } from "three";
import type {
  TerraformPreview,
  TerraformTerrainInvalidation,
} from "./terraform-types";

export interface TerraformThreeOverlayConfig {
  readonly surfaceOffsetMeters: number;
  readonly flattenMarkerHalfSizeMeters: number;
  readonly gridColor: number;
  readonly gridOpacity: number;
  readonly footprintColor: number;
  readonly footprintOpacity: number;
  readonly influenceColor: number;
  readonly influenceOpacity: number;
  readonly invalidColor: number;
  readonly invalidOpacity: number;
  readonly flattenReferenceColor: number;
  readonly flattenReferenceOpacity: number;
}

export interface CreateTerraformThreeOverlayInput {
  readonly mapDefinition: MapDefinitionRead;
  readonly mapState: MapStateRead;
  readonly spatial: WorldSpatialRead;
  readonly terrain: TerrainAuthorityRead;
  readonly config?: Partial<TerraformThreeOverlayConfig>;
}

export interface TerraformThreeOverlay {
  readonly root: Group;
  setActive(active: boolean): void;
  setPreview(preview: TerraformPreview | undefined): void;
  rebuild(invalidation: TerraformTerrainInvalidation): void;
  dispose(): void;
}
