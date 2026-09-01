import type { NewCityPreview } from "@web-three-city/orchestration-city-session";
import type { RegionId } from "@web-three-city/world";

export type NewCityPhase =
  | "configuring"
  | "generating"
  | "preview-ready"
  | "creating";

export interface NewCityViewState {
  readonly name: string;
  readonly seed64: string;
  readonly phase: NewCityPhase;
  readonly preview?: NewCityPreview;
  readonly previewFresh: boolean;
  readonly selectedRegionId?: RegionId;
  readonly error?: string;
}

export type NewCityIntent =
  | { readonly type: "back" }
  | { readonly type: "name-changed"; readonly value: string }
  | { readonly type: "seed-changed"; readonly value: string }
  | { readonly type: "randomize-seed" }
  | { readonly type: "generate" }
  | { readonly type: "select-region"; readonly regionId: RegionId }
  | { readonly type: "create" };
