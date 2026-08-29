import { parseLogicalElevation } from "@web-three-city/terrain";
import {
  createTerrainSystem,
  createTerrainThreeDebugOverlay,
  createTerrainThreeProjection,
  prepareProductionTerrain,
  type TerrainDebugLayer,
  type TerrainDebugVisibility,
  type TerrainThreeDebugOverlay,
  type TerrainThreeProjection,
} from "@web-three-city/terrain/composition";
import { prepareProductionWorldDefinition } from "@web-three-city/world/composition";
import { DirectionalLight, HemisphereLight } from "three";
import { createCityCamera } from "../src/presentation/camera/create-city-camera";
import { createCityInputController } from "../src/presentation/input/create-city-input-controller";
import {
  createTerrainPointerPicker,
  type TerrainPointerPickResult,
} from "../src/presentation/interaction/create-terrain-pointer-picker";
import {
  createScene,
  type SceneCameraConfig,
  type ScenePresentation,
} from "../src/presentation/create-scene";

const GOLDEN_TERRAIN_SEED = "0x5EED5EED5EED5EED";
const OVERVIEW_FOV_DEGREES = 50;
const OVERVIEW_NEAR_METERS = 1;
const OVERVIEW_FAR_SPAN_FACTOR = 4;
const OVERVIEW_HEIGHT_SPAN_FACTOR = 0.9;
const OVERVIEW_DEPTH_SPAN_FACTOR = 0.9;
const OVERVIEW_TARGET_Y_METERS = 0;
const SEMANTIC_EDIT_DELTA = 1;
const DIAGNOSTIC_SKY_COLOR = 0xdce7f2;
const DIAGNOSTIC_GROUND_COLOR = 0x4a4338;
const DIAGNOSTIC_HEMISPHERE_INTENSITY = 1.35;
const DIAGNOSTIC_SUN_COLOR = 0xffffff;
const DIAGNOSTIC_SUN_INTENSITY = 2.4;
const DIAGNOSTIC_SUN_HORIZONTAL_FACTOR = 0.45;
const DIAGNOSTIC_SUN_HEIGHT_FACTOR = 0.8;
const DEBUG_LAYERS: readonly TerrainDebugLayer[] = Object.freeze([
  "cellGrid",
  "renderSectors",
  "vertices",
  "triangles",
  "normals",
  "elevation",
]);

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

function installDiagnosticLighting(input: {
  readonly scene: Extract<ScenePresentation, { readonly available: true }>;
  readonly widthCells: number;
  readonly heightCells: number;
  readonly cellSizeMeters: number;
}): () => void {
  const widthMeters = input.widthCells * input.cellSizeMeters;
  const depthMeters = input.heightCells * input.cellSizeMeters;
  const maxSpanMeters = Math.max(widthMeters, depthMeters);
  const centerX = widthMeters / 2;
  const centerZ = depthMeters / 2;
  const hemisphere = new HemisphereLight(
    DIAGNOSTIC_SKY_COLOR,
    DIAGNOSTIC_GROUND_COLOR,
    DIAGNOSTIC_HEMISPHERE_INTENSITY,
  );
  const sun = new DirectionalLight(
    DIAGNOSTIC_SUN_COLOR,
    DIAGNOSTIC_SUN_INTENSITY,
  );
  sun.position.set(
    centerX - maxSpanMeters * DIAGNOSTIC_SUN_HORIZONTAL_FACTOR,
    maxSpanMeters * DIAGNOSTIC_SUN_HEIGHT_FACTOR,
    centerZ - maxSpanMeters * DIAGNOSTIC_SUN_HORIZONTAL_FACTOR,
  );
  sun.target.position.set(centerX, OVERVIEW_TARGET_Y_METERS, centerZ);
  input.scene.scene.add(hemisphere, sun, sun.target);

  return () => {
    input.scene.scene.remove(hemisphere, sun, sun.target);
  };
}

function installDebugControls(input: {
  readonly root: HTMLElement;
  readonly scene: Extract<ScenePresentation, { readonly available: true }>;
  readonly overlay: TerrainThreeDebugOverlay;
}): { readonly dispose: () => void } {
  const listeners: Array<{
    readonly element: HTMLInputElement;
    readonly listener: () => void;
  }> = [];

  const updateDiagnostics = (): void => {
    const visibility = input.overlay.visibility();
    input.root.dataset.debugLayers = DEBUG_LAYERS.filter(
      (layer) => visibility[layer],
    ).join(",");
  };

  for (const layer of DEBUG_LAYERS) {
    const element = requiredElement<HTMLInputElement>(
      `[data-testid="debug-${layer}"]`,
    );
    const listener = (): void => {
      const next: Partial<TerrainDebugVisibility> = {
        [layer]: element.checked,
      };
      input.overlay.setVisibility(next);
      updateDiagnostics();
      input.scene.render();
    };
    element.addEventListener("change", listener);
    listeners.push({ element, listener });
  }
  updateDiagnostics();

  return Object.freeze({
    dispose(): void {
      for (const { element, listener } of listeners) {
        element.removeEventListener("change", listener);
      }
    },
  });
}

function writePickDiagnostics(
  root: HTMLElement,
  pick: TerrainPointerPickResult,
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

function writeCameraDiagnostics(
  root: HTMLElement,
  camera: ReturnType<typeof createCityCamera>,
): void {
  const state = camera.state();
  root.dataset.cameraTarget = [state.targetX, state.targetY, state.targetZ]
    .map((value) => value.toFixed(3))
    .join(",");
  root.dataset.cameraDistance = state.distance.toFixed(3);
  root.dataset.cameraAzimuth = state.azimuthRadians.toFixed(6);
  root.dataset.cameraElevation = state.elevationRadians.toFixed(6);
}

function pickViewportCenter(input: {
  readonly root: HTMLElement;
  readonly viewport: HTMLElement;
  readonly picker: ReturnType<typeof createTerrainPointerPicker>;
}): void {
  const rect = input.viewport.getBoundingClientRect();
  writePickDiagnostics(
    input.root,
    input.picker.pickClientPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    ),
  );
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

  const terrainPreparation = prepareProductionTerrain({
    world: preparedWorld,
    seed64: GOLDEN_TERRAIN_SEED,
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
    fingerprint: preparedTerrain.fingerprint,
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

  const disposeDiagnosticLighting = installDiagnosticLighting({
    scene,
    widthCells: mapDefinition.widthCells,
    heightCells: mapDefinition.heightCells,
    cellSizeMeters: mapDefinition.cellSizeMeters,
  });
  const productionCamera = createCityCamera({
    camera: scene.camera,
    map: mapDefinition,
  });

  const projectionConstruction = createTerrainThreeProjection({
    mapDefinition,
    world: preparedWorld.spatial,
    terrain: terrain.read,
  });
  if (projectionConstruction.status !== "success") {
    disposeDiagnosticLighting();
    scene.dispose();
    throw new Error(
      `Terrain projection failed: ${projectionConstruction.code}.`,
    );
  }
  const projection = projectionConstruction.value;
  const debugConstruction = createTerrainThreeDebugOverlay({
    mapDefinition,
    world: preparedWorld.spatial,
    terrain: terrain.read,
  });
  if (debugConstruction.status !== "success") {
    projection.dispose();
    disposeDiagnosticLighting();
    scene.dispose();
    throw new Error(`Terrain debug overlay failed: ${debugConstruction.code}.`);
  }
  const debugOverlay = debugConstruction.value;
  const debugControls = installDebugControls({
    root,
    scene,
    overlay: debugOverlay,
  });
  const pointerPicker = createTerrainPointerPicker({
    viewport,
    camera: scene.camera,
    projection,
  });
  let tapCount = 0;
  const requestRender = (): void => {
    writeCameraDiagnostics(root, productionCamera);
    scene.render();
  };
  const inputController = createCityInputController({
    viewport,
    camera: productionCamera,
    requestRender,
    onTap(clientX, clientY): void {
      tapCount += 1;
      root.dataset.tapCount = String(tapCount);
      writePickDiagnostics(
        root,
        pointerPicker.pickClientPoint(clientX, clientY),
      );
    },
  });

  scene.scene.add(projection.root, debugOverlay.root);
  requestRender();

  root.dataset.diagnosticLighting = "ready";
  root.dataset.productionCamera = "ready";
  root.dataset.inputController = "ready";
  root.dataset.tapCount = "0";
  root.dataset.debugOverlay = "ready";
  root.dataset.terrainSectors = String(projection.root.children.length);
  root.dataset.terrainRevision = String(terrain.read.revision());
  root.dataset.presentationRevision = String(terrain.read.revision());
  pickViewportCenter({ root, viewport, picker: pointerPicker });
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
    debugOverlay.rebuild(mutation.value.changeSet);
    requestRender();
    root.dataset.terrainRevision = String(terrain.read.revision());
    root.dataset.presentationRevision = String(mutation.value.newRevision);
    pickViewportCenter({ root, viewport, picker: pointerPicker });
  });

  window.addEventListener(
    "pagehide",
    () => {
      inputController.dispose();
      debugControls.dispose();
      debugOverlay.dispose();
      projection.dispose();
      disposeDiagnosticLighting();
      scene.dispose();
    },
    { once: true },
  );
}

bootstrap();
