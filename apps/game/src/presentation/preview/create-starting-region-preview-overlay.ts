import type { NewCityPreview } from "@web-three-city/orchestration-city-session";
import {
  LOGICAL_ELEVATION_METERS,
  type TerrainAuthorityRead,
} from "@web-three-city/terrain";
import type { RegionId } from "@web-three-city/world";
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  type Raycaster,
} from "three";

export interface StartingRegionPreviewOverlay {
  readonly root: Group;
  setSelectedRegion(regionId: RegionId | undefined): void;
  pick(raycaster: Raycaster): RegionId | undefined;
  dispose(): void;
}

const MARKER_RADIUS_METERS = 18;
const MARKER_Y_OFFSET_METERS = 12;
const AVAILABLE_COLOR = 0xf4f4f5;
const SELECTED_COLOR = 0x60a5fa;

export function createStartingRegionPreviewOverlay(input: {
  readonly preview: NewCityPreview;
  readonly terrain: TerrainAuthorityRead;
}): StartingRegionPreviewOverlay {
  const root = new Group();
  root.name = "starting-region-preview-overlay";
  const geometry = new SphereGeometry(MARKER_RADIUS_METERS, 16, 12);
  const markers = new Map<RegionId, Mesh<SphereGeometry, MeshBasicMaterial>>();

  for (const candidate of input.preview.preparedWorld.mapDefinition
    .startingCandidates) {
    if (!input.preview.eligibleStartingRegionIds.includes(candidate.regionId)) {
      continue;
    }
    const bounds = input.preview.preparedWorld.spatial.cellBounds(
      candidate.anchor,
    );
    const surface = input.terrain.cellSurface(candidate.anchor);
    if (bounds.status !== "success" || surface.status !== "success") continue;
    const elevation =
      (surface.value.sw +
        surface.value.se +
        surface.value.nw +
        surface.value.ne) /
      4;
    const marker = new Mesh(
      geometry,
      new MeshBasicMaterial({ color: AVAILABLE_COLOR, depthTest: false }),
    );
    marker.position.set(
      (bounds.value.xMinInclusive + bounds.value.xMaxExclusive) / 2,
      elevation * LOGICAL_ELEVATION_METERS + MARKER_Y_OFFSET_METERS,
      (bounds.value.zMinInclusive + bounds.value.zMaxExclusive) / 2,
    );
    marker.renderOrder = 20;
    marker.userData.regionId = candidate.regionId;
    markers.set(candidate.regionId, marker);
    root.add(marker);
  }

  let selectedRegionId: RegionId | undefined;
  let disposed = false;
  const setSelectedRegion = (regionId: RegionId | undefined): void => {
    selectedRegionId = regionId;
    for (const [id, marker] of markers) {
      marker.material.color.setHex(
        id === selectedRegionId ? SELECTED_COLOR : AVAILABLE_COLOR,
      );
    }
  };

  return Object.freeze({
    root,
    setSelectedRegion,
    pick(raycaster: Raycaster): RegionId | undefined {
      if (disposed) return undefined;
      const hit = raycaster.intersectObjects([...markers.values()], false)[0];
      const regionId = hit?.object.userData.regionId;
      return typeof regionId === "string" ? (regionId as RegionId) : undefined;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      root.clear();
      for (const marker of markers.values()) marker.material.dispose();
      markers.clear();
      geometry.dispose();
    },
  });
}
