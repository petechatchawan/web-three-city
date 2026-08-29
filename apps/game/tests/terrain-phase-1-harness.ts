import { parseLogicalElevation } from "@web-three-city/terrain";
import {
  createTerrainSystem,
  createTerrainThreeProjection,
  prepareProductionTerrain,
  type TerrainSemanticPickResult,
  type TerrainThreeProjection,
} from "@web-three-city/terrain/composition";
import { prepareProductionWorldDefinition } from "@web-three-city/world/composition";
import { Raycaster, Vector2 } from "three";
import {
  createScene,
  type SceneCameraConfig,
  type ScenePresentation,
} from "../src/presentation/create-scene";

const OVERVIEW_FOV_DEGREES = 50;
const OVERVIEW_NEAR_METERS = 1;
const OVERVIEW_FAR_SPAN_FACTOR = 4;
const OVERVIEW_HEIGHT_SPAN_FACTOR = 0.9;
const OVERVIEW_DEPTH_SPAN_FACTOR = 0.9;
const OVERVIEW_TARGET_Y_METERS = 0;
const SEMANTIC_EDIT_DELTA = 1;

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(
      `Terrain presentation harness element ${selector} was not found.`,
    );
  }
  return element;
}

function createOverviewCameraConfig(input: {
  readonly widthCells: number;
  readonly heightCells: number;
  readonly cellSizeMeters: number;
}): SceneCameraConfig {
  const widthMeters = input.widthCells * input.cellSizeMeters;
  const depthMeters = input.heightCells * input.cellSizeMeters;
  const maxSpanMeters = Math.max(widthMeters, depthMeters);
  const centerX = widthMeters / 2;
  const centerZ = depthMeters / 2;

  return Object.freeze({
    fovDegrees: OVERVIEW_FOV_DEGREES,
    nearMeters: OVERVIEW_NEAR_METERS,
    farMeters: maxSpanMeters * OVERVIEW_FAR_SPAN_FACTOR,
    position: [
      centerX,
      maxSpanMeters * OVERVIEW_HEIGHT_SPAN_FACTOR,
      centerZ + maxSpanMeters * OVERVIEW_DEPTH_SPAN_FACTOR,
    ] as const,
    target: [centerX, OVERVIEW_TARGET_Y_METERS, centerZ] as const,
  });
}

function writePickDiagnostics(
  root: HTMLElement,
  pick: TerrainSemanticPickResult,
): void {
  root.dataset.pickStatus = pick.status;
  delete root.dataset.pickCell;
  delete root.dataset.pickTriangle;
  delete root.dataset.pickRevision;

  if (pick.status !== "hit") return;
  root.dataset.pickCell = `${pick.value.cell.x},${pick.value.cell.z}`;
  root.dataset.pickTriangle = pick.value.triangle;
  root.dataset.pickRevision = String(pick.value.revision);
}

function refreshSemanticPick(input: {
  readonly root: HTMLElement;
  readonly scene: Extract<ScenePresentation, { readonly available: true }>;
  readonly projection: TerrainThreeProjection;
}): void {
  input.scene.scene.updateMatrixWorld(true);
  input.scene.camera.updateMatrixWorld(true);
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(0, 0), input.scene.camera);
  writePickDiagnostics(input.root, input.projection.pick(raycaster));
}

function bootstrap(): void {
  const root = requiredElement<HTMLElement>("#terrain-phase-1");
  const viewport = requiredElement<HTMLElement>("#terrain-viewport");
  const rebuildButton = requiredElement<HTMLButtonElement>(
    '[data-testid="terrain-rebuild"]',
  );

  const worldPreparation = prepareProductionWorldDefinition();
  if (worldPreparation.status !== "success") {
    throw new Error(`World preparation failed: ${worldPreparation.code}.`);
  }

  const preparedWorld = worldPreparation.value;
  const mapDefinition = preparedWorld.mapDefinition;
  const acceptedSeed = mapDefinition.acceptedTerrainSeeds[0];
  if (acceptedSeed === undefined) {
    throw new Error("Production MapDefinition has no accepted Terrain seed.");
  }

  const terrainPreparation = prepareProductionTerrain({
    world: preparedWorld,
    seed64: acceptedSeed,
  });
  if (terrainPreparation.status !== "success") {
    throw new Error(`Terrain preparation failed: ${terrainPreparation.code}.`);
  }

  const preparedTerrain = terrainPreparation.value;
  const terrainConstruction = createTerrainSystem({
    world: preparedWorld.spatial,
    mapDefinitionId: mapDefinition.mapDefinitionId,
    generationProfileId: mapDefinition.terrainGenerationProfileId,
    generationProfileVersion: mapDefinition.terrainGenerationProfileVersion,
    selectedSeed64: preparedTerrain.selectedSeed64,
    source: preparedTerrain.field,
  });
  if (terrainConstruction.status !== "success") {
    throw new Error(
      `Terrain construction failed: ${terrainConstruction.reason}.`,
    );
  }
  const terrain = terrainConstruction.value;

  const scene = createScene(
    viewport,
    createOverviewCameraConfig(mapDefinition),
  );
  root.dataset.webgl = scene.available ? "available" : "unavailable";
  if (!scene.available) {
    root.dataset.presentation = "unavailable";
    return;
  }

  const projectionConstruction = createTerrainThreeProjection({
    mapDefinition,
    world: preparedWorld.spatial,
    terrain: terrain.read,
  });
  if (projectionConstruction.status !== "success") {
    scene.dispose();
    throw new Error(
      `Terrain projection failed: ${projectionConstruction.code}.`,
    );
  }
  const projection = projectionConstruction.value;

  scene.scene.add(projection.root);
  scene.render();

  root.dataset.terrainSectors = String(projection.root.children.length);
  root.dataset.terrainRevision = String(terrain.read.revision());
  root.dataset.presentationRevision = String(terrain.read.revision());
  refreshSemanticPick({ root, scene, projection });
  root.dataset.presentation = "ready";

  rebuildButton.addEventListener("click", () => {
    const centerVertex = {
      x: Math.floor(mapDefinition.widthCells / 2),
      z: Math.floor(mapDefinition.heightCells / 2),
    };
    const current = terrain.read.elevationAt(centerVertex);
    if (current.status !== "success") {
      throw new Error(
        "Center Terrain elevation is unavailable for test mutation.",
      );
    }

    const next = parseLogicalElevation(current.value + SEMANTIC_EDIT_DELTA);
    if (next.status !== "success") {
      throw new Error(
        `Center Terrain elevation mutation is invalid: ${next.code}.`,
      );
    }

    const mutation = terrain.commands.applyEdits({
      edits: [{ vertex: centerVertex, elevation: next.value }],
    });
    if (mutation.status !== "success") {
      throw new Error(`Terrain mutation failed: ${mutation.rejection.code}.`);
    }
    if (!mutation.value.changed) {
      throw new Error("Terrain mutation unexpectedly produced a no-op.");
    }

    projection.rebuild(mutation.value.changeSet);
    scene.render();
    root.dataset.terrainRevision = String(terrain.read.revision());
    root.dataset.presentationRevision = String(mutation.value.newRevision);
    refreshSemanticPick({ root, scene, projection });
  });

  window.addEventListener(
    "pagehide",
    () => {
      projection.dispose();
      scene.dispose();
    },
    { once: true },
  );
}

bootstrap();
