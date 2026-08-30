import type { LiveCitySession } from "@web-three-city/orchestration-city-session";
import {
  createTerrainThreeDebugOverlay,
  createTerrainThreeProjection,
  type TerrainDebugLayer,
  type TerrainDebugVisibility,
  type TerrainThreeDebugOverlay,
  type TerrainThreeProjection,
} from "@web-three-city/terrain/composition";
import { createCityCamera } from "../presentation/camera/create-city-camera";
import { createCitySceneCameraConfig } from "../presentation/camera/create-city-scene-camera-config";
import { createCityLighting } from "../presentation/create-city-lighting";
import { createScene } from "../presentation/create-scene";
import {
  createCityInputController,
  type CityInputController,
} from "../presentation/input/create-city-input-controller";
import {
  createTerrainPointerPicker,
  type TerrainPointerPickResult,
} from "../presentation/interaction/create-terrain-pointer-picker";
import {
  createGameScreen,
  type GameScreenHandle,
} from "../ui/screens/create-game-screen";

const DEBUG_LAYER_ORDER: readonly TerrainDebugLayer[] = Object.freeze([
  "cellGrid",
  "renderSectors",
  "vertices",
  "triangles",
  "normals",
  "elevation",
]);

export type SaveCityUiResult =
  | { readonly status: "success" }
  | { readonly status: "error"; readonly message: string };

export interface LiveCityExperience {
  dispose(): void;
}

function writePick(
  screen: GameScreenHandle,
  pick: TerrainPointerPickResult,
): void {
  screen.element.dataset.pickStatus = pick.status;
  if (pick.status === "hit") {
    screen.element.dataset.pickCell = `${pick.value.cell.x},${pick.value.cell.z}`;
    screen.setPickStatus(`Cell ${pick.value.cell.x}, ${pick.value.cell.z}`);
    return;
  }
  delete screen.element.dataset.pickCell;
  screen.setPickStatus(
    pick.status === "miss"
      ? `No terrain hit: ${pick.reason}`
      : "Terrain unavailable",
  );
}

function writeCameraDiagnostics(
  screen: GameScreenHandle,
  camera: ReturnType<typeof createCityCamera>,
): void {
  const state = camera.state();
  screen.element.dataset.cameraTarget = [
    state.targetX,
    state.targetY,
    state.targetZ,
  ]
    .map((value) => value.toFixed(3))
    .join(",");
  screen.element.dataset.cameraDistance = state.distance.toFixed(3);
  screen.element.dataset.cameraAzimuth = state.azimuthRadians.toFixed(6);
  screen.element.dataset.cameraElevation = state.elevationRadians.toFixed(6);
}

function debugLayers(overlay: TerrainThreeDebugOverlay): string {
  const visibility = overlay.visibility();
  return DEBUG_LAYER_ORDER.filter((layer) => visibility[layer]).join(",");
}

export function createLiveCityExperience(input: {
  readonly mount: HTMLElement;
  readonly session: LiveCitySession;
  readonly onSave: () => Promise<SaveCityUiResult>;
  readonly onExit: () => void;
}): LiveCityExperience {
  const map = input.session.world.definition.mapDefinition;
  let disposed = false;
  let lighting: ReturnType<typeof createCityLighting> | undefined;
  let overlay: TerrainThreeDebugOverlay | undefined;
  let liveProjection: TerrainThreeProjection | undefined;
  let inputController: CityInputController | undefined;
  let cameraController: ReturnType<typeof createCityCamera> | undefined;
  let saving = false;

  const updateDebugDiagnostics = (): void => {
    if (overlay === undefined) return;
    const layers = DEBUG_LAYER_ORDER.filter(
      (layer) => overlay?.visibility()[layer],
    );
    screen.element.dataset.debugLayers = layers.join(",");
    screen.setDebugLayers(layers);
  };

  const requestRender = (): void => {
    if (cameraController !== undefined) {
      writeCameraDiagnostics(screen, cameraController);
    }
    if (scene.available) scene.render();
  };

  const save = async (): Promise<void> => {
    if (saving || disposed) return;
    saving = true;
    screen.setSaving(true);
    screen.setSaveStatus("Saving…");
    try {
      const result = await input.onSave();
      screen.setSaveStatus(
        result.status === "success" ? "Saved" : result.message,
      );
    } finally {
      saving = false;
      screen.setSaving(false);
    }
  };

  const onDebugChange = (layer: TerrainDebugLayer, checked: boolean): void => {
    if (overlay === undefined || disposed) return;
    const next: Partial<TerrainDebugVisibility> = { [layer]: checked };
    overlay.setVisibility(next);
    updateDebugDiagnostics();
    requestRender();
  };

  const screen = createGameScreen({
    cityName: input.session.metadata.name,
    seed64: input.session.terrain.captureSnapshot().selectedSeed64,
    revision: input.session.terrain.read.revision(),
    onSave: () => void save(),
    onExit: input.onExit,
    onDebugChange,
    onClearDebug: () => {
      if (overlay === undefined || disposed) return;
      overlay.setVisibility(
        Object.fromEntries(DEBUG_LAYER_ORDER.map((layer) => [layer, false])),
      );
      updateDebugDiagnostics();
      requestRender();
    },
  });
  input.mount.replaceChildren(screen.element);
  input.mount.dataset.liveRuntime = "booting";

  const scene = createScene(screen.viewport, createCitySceneCameraConfig(map));
  if (!scene.available) {
    screen.setPickStatus("WebGL unavailable");
    input.mount.dataset.liveRuntime = "unavailable";
  } else {
    lighting = createCityLighting({ scene: scene.scene, map });
    const projected = createTerrainThreeProjection({
      mapDefinition: map,
      world: input.session.world.spatial,
      terrain: input.session.terrain.read,
    });
    if (projected.status !== "success") {
      throw new Error(`Terrain projection rejected: ${projected.code}`);
    }
    const projection = projected.value;
    liveProjection = projection;
    const debug = createTerrainThreeDebugOverlay({
      mapDefinition: map,
      world: input.session.world.spatial,
      terrain: input.session.terrain.read,
    });
    if (debug.status !== "success") {
      projection.dispose();
      throw new Error(`Terrain debug overlay rejected: ${debug.code}`);
    }
    overlay = debug.value;
    scene.scene.add(projection.root, overlay.root);

    const camera = createCityCamera({ camera: scene.camera, map });
    cameraController = camera;
    const picker = createTerrainPointerPicker({
      viewport: screen.viewport,
      camera: scene.camera,
      projection,
    });
    inputController = createCityInputController({
      viewport: screen.viewport,
      camera,
      requestRender,
      onTap(clientX, clientY): void {
        writePick(screen, picker.pickClientPoint(clientX, clientY));
      },
    });
    screen.element.dataset.inputController = "ready";
    screen.element.dataset.terrainSectors = String(
      projection.root.children.length,
    );
    updateDebugDiagnostics();
    requestRender();
    const rect = screen.viewport.getBoundingClientRect();
    writePick(
      screen,
      picker.pickClientPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      ),
    );
    input.mount.dataset.liveRuntime = "ready";
  }

  const experience: LiveCityExperience = {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      inputController?.dispose();
      overlay?.dispose();
      liveProjection?.dispose();
      lighting?.dispose();
      scene.dispose();
      screen.dispose();
      screen.element.remove();
      input.mount.dataset.liveRuntime = "disposed";
    },
  };
  return Object.freeze(experience);
}
