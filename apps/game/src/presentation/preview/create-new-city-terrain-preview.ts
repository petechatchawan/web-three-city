import type { NewCityPreview } from "@web-three-city/orchestration-city-session";
import {
  createTerrainSystem,
  createTerrainThreeProjection,
} from "@web-three-city/terrain/composition";
import type { RegionId } from "@web-three-city/world";
import { Raycaster, Vector2 } from "three";
import { readPreparedTerrainPresentationSource } from "../../composition/systems/prepared-terrain-handle";
import { createCityCamera } from "../camera/create-city-camera";
import { createCitySceneCameraConfig } from "../camera/create-city-scene-camera-config";
import { createCityLighting } from "../create-city-lighting";
import { createScene } from "../create-scene";
import { createCityInputController } from "../input/create-city-input-controller";
import { createStartingRegionPreviewOverlay } from "./create-starting-region-preview-overlay";

export interface NewCityTerrainPreviewHandle {
  readonly element: HTMLElement;
  setSelectedRegion(regionId: RegionId | undefined): void;
  resize(): void;
  dispose(): void;
}

export interface NewCityTerrainPreviewFactory {
  create(input: {
    readonly mount: HTMLElement;
    readonly preview: NewCityPreview;
    readonly onSelectRegion: (regionId: RegionId) => void;
  }): NewCityTerrainPreviewHandle | undefined;
}

export function createNewCityTerrainPreview(input: {
  readonly mount: HTMLElement;
  readonly preview: NewCityPreview;
  readonly onSelectRegion: (regionId: RegionId) => void;
}): NewCityTerrainPreviewHandle | undefined {
  const source = readPreparedTerrainPresentationSource(
    input.preview.preparedTerrain,
  );
  if (source === undefined) return undefined;

  const terrainResult = createTerrainSystem({
    world: input.preview.preparedWorld.spatial,
    mapDefinitionId: source.mapDefinition.mapDefinitionId,
    generationProfileId: source.mapDefinition.terrainGenerationProfileId,
    generationProfileVersion:
      source.mapDefinition.terrainGenerationProfileVersion,
    selectedSeed64: source.prepared.selectedSeed64,
    fingerprint: source.prepared.fingerprint,
    source: source.prepared.field,
  });
  if (terrainResult.status !== "success") return undefined;
  const terrain = terrainResult.value;

  const projectionResult = createTerrainThreeProjection({
    mapDefinition: source.mapDefinition,
    world: input.preview.preparedWorld.spatial,
    terrain: terrain.read,
  });
  if (projectionResult.status !== "success") return undefined;
  const projection = projectionResult.value;

  const scene = createScene(
    input.mount,
    createCitySceneCameraConfig(source.mapDefinition),
  );
  if (!scene.available) {
    projection.dispose();
    return undefined;
  }

  const lighting = createCityLighting({
    scene: scene.scene,
    map: source.mapDefinition,
  });
  const overlay = createStartingRegionPreviewOverlay({
    preview: input.preview,
    terrain: terrain.read,
  });
  scene.scene.add(projection.root, overlay.root);
  const camera = createCityCamera({
    camera: scene.camera,
    map: source.mapDefinition,
  });
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let disposed = false;

  const requestRender = (): void => {
    if (!disposed) scene.render();
  };
  const pickRegion = (clientX: number, clientY: number): void => {
    if (disposed) return;
    const rect = input.mount.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return;
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, scene.camera);
    const regionId = overlay.pick(raycaster);
    if (regionId !== undefined) input.onSelectRegion(regionId);
  };
  const cityInput = createCityInputController({
    viewport: input.mount,
    camera,
    requestRender,
    onTap: pickRegion,
  });

  input.mount.dataset.previewSourceSeed = source.prepared.selectedSeed64;
  input.mount.dataset.previewSourceFingerprint = source.prepared.fingerprint;
  scene.render();

  return Object.freeze({
    element: input.mount,
    setSelectedRegion(regionId: RegionId | undefined): void {
      if (disposed) return;
      overlay.setSelectedRegion(regionId);
      scene.render();
    },
    resize(): void {
      if (disposed) return;
      scene.render();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      cityInput.dispose();
      overlay.dispose();
      projection.dispose();
      lighting.dispose();
      scene.dispose();
      delete input.mount.dataset.previewSourceSeed;
      delete input.mount.dataset.previewSourceFingerprint;
    },
  });
}

export const newCityTerrainPreviewFactory: NewCityTerrainPreviewFactory =
  Object.freeze({ create: createNewCityTerrainPreview });
