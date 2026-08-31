import type { LiveCitySession } from "@web-three-city/orchestration-city-session";
import {
  logicalElevationToMeters,
  type LogicalElevation,
} from "@web-three-city/terrain";
import {
  createTerrainThreeDebugOverlay,
  createTerrainThreeProjection,
  type TerrainDebugLayer,
  type TerrainDebugVisibility,
  type TerrainThreeDebugOverlay,
  type TerrainThreeProjection,
} from "@web-three-city/terrain/composition";
import {
  selectFlattenReference,
  type TerraformBrushSize,
  type TerraformOperation,
  type TerraformPreview,
  type TerraformStrength,
  type TerraformUndoHistory,
} from "@web-three-city/terraform";
import {
  createTerraformThreeOverlay,
  createTerraformUndoHistory,
  planTerraform,
  type TerraformThreeOverlay,
} from "@web-three-city/terraform/composition";
import { createCityCamera } from "../presentation/camera/create-city-camera";
import { createCitySceneCameraConfig } from "../presentation/camera/create-city-scene-camera-config";
import { createCityLighting } from "../presentation/create-city-lighting";
import { createScene } from "../presentation/create-scene";
import {
  createCityInputController,
  type CityInputController,
} from "../presentation/input/create-city-input-controller";
import { CITY_INPUT_DEFAULT_CONFIG } from "../presentation/input/input-config";
import {
  createTerrainPointerPicker,
  type TerrainPointerPickResult,
} from "../presentation/interaction/create-terrain-pointer-picker";
import {
  createGameScreen,
  type GameScreenHandle,
} from "../ui/screens/create-game-screen";
import {
  createGameCommandRouter,
  type GameCommandRouter,
} from "./game/create-game-command-router";
import {
  createGameInteractionRouter,
  type GameInteractionRouter,
} from "./game/create-game-interaction-router";
import {
  createGameToolCoordinator,
  type GameToolCoordinator,
  type GameToolRuntime,
} from "./game/create-game-tool-coordinator";
import { createTerraformPointerSession } from "./terraform/terraform-pointer-session";
import {
  createTerraformRuntime,
  type TerraformRuntime,
} from "./terraform/create-terraform-runtime";

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

export function createLiveCityExperience(input: {
  readonly mount: HTMLElement;
  readonly session: LiveCitySession;
  readonly onSave: () => Promise<SaveCityUiResult>;
  readonly onExit: () => void;
}): LiveCityExperience {
  const map = input.session.world.definition.mapDefinition;
  let disposed = false;
  let lighting: ReturnType<typeof createCityLighting> | undefined;
  let debugOverlay: TerrainThreeDebugOverlay | undefined;
  let liveProjection: TerrainThreeProjection | undefined;
  let terraformOverlay: TerraformThreeOverlay | undefined;
  let terraformRuntime: TerraformRuntime | undefined;
  let terraformUndo: TerraformUndoHistory | undefined;
  let terraformPointerSession:
    | ReturnType<typeof createTerraformPointerSession>
    | undefined;
  let inputController: CityInputController | undefined;
  let toolCoordinator: GameToolCoordinator | undefined;
  let interactionRouter: GameInteractionRouter | undefined;
  let commandRouter: GameCommandRouter | undefined;
  let cameraController: ReturnType<typeof createCityCamera> | undefined;
  let saving = false;
  let terraformActive = false;
  let terraformOperation: TerraformOperation = "raise";
  let terraformBrushSize: TerraformBrushSize = 1;
  let terraformStrength: TerraformStrength = "normal";
  let flattenTarget: LogicalElevation | undefined;
  let lastPreviewPoint: readonly [number, number] | undefined;

  const updateDebugDiagnostics = (): void => {
    if (debugOverlay === undefined) return;
    const layers = DEBUG_LAYER_ORDER.filter(
      (layer) => debugOverlay?.visibility()[layer],
    );
    screen.element.dataset.debugLayers = layers.join(",");
    screen.setDebugLayers(layers);
  };

  const updateTerraformDiagnostics = (
    preview?: TerraformPreview,
    status?: string,
  ): void => {
    screen.element.dataset.terraformActive = String(terraformActive);
    screen.element.dataset.terraformOperation = terraformOperation;
    screen.element.dataset.terraformBrush = String(terraformBrushSize);
    screen.element.dataset.terraformStrength = terraformStrength;
    screen.element.dataset.terraformPreview = preview?.status ?? "none";
    screen.element.dataset.terraformUndoDepth = String(
      terraformUndo?.depth() ?? 0,
    );
    screen.element.dataset.terrainRevision = String(
      input.session.terrain.read.revision(),
    );
    screen.terraform.setActive(terraformActive);
    screen.terraform.setOperation(terraformOperation);
    screen.terraform.setBrushSize(terraformBrushSize);
    screen.terraform.setStrength(terraformStrength);
    screen.terraform.setFlattenTargetMeters(
      flattenTarget === undefined
        ? undefined
        : logicalElevationToMeters(flattenTarget),
    );
    screen.terraform.setUndoDepth(terraformUndo?.depth() ?? 0);
    if (status !== undefined) screen.terraform.setStatus(status);
  };

  const requestRender = (): void => {
    if (cameraController !== undefined) {
      writeCameraDiagnostics(screen, cameraController);
    }
    if (scene.available) scene.render();
  };

  const clearTerraformPreview = (): void => {
    lastPreviewPoint = undefined;
    terraformOverlay?.setPreview(undefined);
    updateTerraformDiagnostics(undefined);
    requestRender();
  };

  let previewTerraformPoint: (clientX: number, clientY: number) => void = () =>
    undefined;
  let commitTerraformPoint: (clientX: number, clientY: number) => void = () =>
    undefined;

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
    if (debugOverlay === undefined || disposed) return;
    const next: Partial<TerrainDebugVisibility> = { [layer]: checked };
    debugOverlay.setVisibility(next);
    updateDebugDiagnostics();
    requestRender();
  };

  const refreshPreview = (): void => {
    const point = lastPreviewPoint;
    if (terraformActive && point !== undefined) {
      previewTerraformPoint(point[0], point[1]);
    } else {
      clearTerraformPreview();
    }
  };

  const activateLegacyTerraform = (): void => {
    if (disposed || terraformActive) return;
    terraformActive = true;
    terraformOverlay?.setActive(true);
    updateTerraformDiagnostics(undefined, "Terraform active");
    requestRender();
  };

  const deactivateLegacyTerraform = (): void => {
    if (disposed || !terraformActive) return;
    terraformActive = false;
    flattenTarget = undefined;
    lastPreviewPoint = undefined;
    terraformOverlay?.setPreview(undefined);
    terraformOverlay?.setActive(false);
    updateTerraformDiagnostics(undefined, "Terraform closed");
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
      if (debugOverlay === undefined || disposed) return;
      debugOverlay.setVisibility(
        Object.fromEntries(DEBUG_LAYER_ORDER.map((layer) => [layer, false])),
      );
      updateDebugDiagnostics();
      requestRender();
    },
    onTerraformOpen: () => {
      if (disposed) return;
      if (toolCoordinator === undefined) activateLegacyTerraform();
      else toolCoordinator.activate("terrain");
    },
    onTerraformClose: () => {
      if (disposed) return;
      if (toolCoordinator?.activeToolId() === "terrain")
        toolCoordinator.deactivate();
      else deactivateLegacyTerraform();
    },
    onTerraformOperation: (operation) => {
      terraformOperation = operation;
      if (operation !== "flatten") flattenTarget = undefined;
      refreshPreview();
    },
    onTerraformBrushSize: (size) => {
      terraformBrushSize = size;
      refreshPreview();
    },
    onTerraformStrength: (strength) => {
      terraformStrength = strength;
      refreshPreview();
    },
    onTerraformRepickLevel: () => {
      flattenTarget = undefined;
      refreshPreview();
      updateTerraformDiagnostics(undefined, "Pick a Flatten reference level");
    },
    onTerraformUndo: () => {
      if (!terraformActive || terraformRuntime === undefined) return;
      const result = terraformRuntime.undo();
      refreshPreview();
      updateTerraformDiagnostics(
        undefined,
        result.status === "success" ? "Undo applied" : "Undo unavailable",
      );
      requestRender();
    },
  });
  input.mount.replaceChildren(screen.element);
  input.mount.dataset.liveRuntime = "booting";
  screen.element.dataset.terraformOverlayRoots = "0";
  updateTerraformDiagnostics();

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
    debugOverlay = debug.value;
    terraformOverlay = createTerraformThreeOverlay({
      mapDefinition: map,
      spatial: input.session.world.spatial,
      mapState: input.session.world.mapState,
      terrain: input.session.terrain.read,
    });
    terraformOverlay.setActive(false);
    terraformOverlay.root.userData.testid = "terraform-overlay-root";
    scene.scene.add(projection.root, debugOverlay.root, terraformOverlay.root);
    screen.element.dataset.terraformOverlayRoots = String(
      scene.scene.children.filter(
        (child) => child.name === "terraform-three-overlay",
      ).length,
    );

    terraformUndo = createTerraformUndoHistory(
      input.session.terrain.read.revision(),
    );
    terraformRuntime = createTerraformRuntime({
      terrain: input.session.terrain,
      projection,
      debugOverlay,
      terraformPresentation: terraformOverlay,
      undo: terraformUndo,
    });

    const camera = createCityCamera({ camera: scene.camera, map });
    cameraController = camera;
    const picker = createTerrainPointerPicker({
      viewport: screen.viewport,
      camera: scene.camera,
      projection,
    });

    const planFromPick = (
      pick: Extract<TerrainPointerPickResult, { status: "hit" }>,
    ): TerraformPreview =>
      planTerraform({
        operation: terraformOperation,
        targetCell: pick.value.cell,
        brushSize: terraformBrushSize,
        strength: terraformStrength,
        ...(flattenTarget === undefined ? {} : { flattenTarget }),
        mapDefinition: map,
        mapState: input.session.world.mapState,
        spatial: input.session.world.spatial,
        terrain: input.session.terrain.read,
      });

    previewTerraformPoint = (clientX, clientY): void => {
      if (!terraformActive || disposed) return;
      lastPreviewPoint = Object.freeze([clientX, clientY]);
      const pick = picker.pickClientPoint(clientX, clientY);
      writePick(screen, pick);
      if (pick.status !== "hit") {
        terraformOverlay?.setPreview(undefined);
        updateTerraformDiagnostics(undefined, "No editable Terrain target");
        requestRender();
        return;
      }
      const preview = planFromPick(pick);
      terraformOverlay?.setPreview(preview);
      updateTerraformDiagnostics(
        preview,
        preview.status === "valid" ? "Ready" : preview.reason,
      );
      requestRender();
    };

    commitTerraformPoint = (clientX, clientY): void => {
      const pick = picker.pickClientPoint(clientX, clientY);
      writePick(screen, pick);
      if (!terraformActive || pick.status !== "hit") return;

      if (terraformOperation === "flatten" && flattenTarget === undefined) {
        const reference = selectFlattenReference({
          pick: pick.value,
          mapDefinition: map,
          mapState: input.session.world.mapState,
          spatial: input.session.world.spatial,
          terrain: input.session.terrain.read,
        });
        if (reference.status === "success") {
          flattenTarget = reference.value;
          updateTerraformDiagnostics(
            undefined,
            `Flatten level ${logicalElevationToMeters(reference.value).toFixed(2)}m selected`,
          );
          previewTerraformPoint(clientX, clientY);
        } else {
          updateTerraformDiagnostics(undefined, reference.reason);
        }
        return;
      }

      const preview = planFromPick(pick);
      if (preview.status !== "valid" || terraformRuntime === undefined) {
        terraformOverlay?.setPreview(preview);
        updateTerraformDiagnostics(
          preview,
          preview.status === "invalid" ? preview.reason : "Unavailable",
        );
        requestRender();
        return;
      }
      const result = terraformRuntime.commit(preview.plan);
      const refreshed = planFromPick(pick);
      terraformOverlay?.setPreview(refreshed);
      updateTerraformDiagnostics(
        refreshed,
        result.status === "success"
          ? "Terrain updated"
          : result.status === "noop"
            ? "No Terrain change"
            : result.reason,
      );
      requestRender();
    };

    terraformPointerSession = createTerraformPointerSession({
      tapThresholdPixels: CITY_INPUT_DEFAULT_CONFIG.tapThresholdPixels,
      onPreviewClientPoint: (x, y) => previewTerraformPoint(x, y),
      onClearPreview: clearTerraformPreview,
    });

    const legacyTerrainTool: GameToolRuntime = {
      descriptor: {
        id: "terrain",
        label: "Terrain",
        icon: "terrain",
        shortcut: "T",
        order: 10,
      },
      availability: () => ({ status: "available" }),
      activate: activateLegacyTerraform,
      deactivate: deactivateLegacyTerraform,
      dispose: () => undefined,
      view: { element: screen.terraform.tray, dispose: () => undefined },
      pointerSink: terraformPointerSession,
      onSemanticTap: commitTerraformPoint,
    };
    toolCoordinator = createGameToolCoordinator([legacyTerrainTool]);
    interactionRouter = createGameInteractionRouter({
      toolCoordinator,
      onSelectionTap: (clientX, clientY) =>
        writePick(screen, picker.pickClientPoint(clientX, clientY)),
    });
    commandRouter = createGameCommandRouter({
      toolShortcuts: [{ toolId: "terrain", key: "t" }],
      onCommand: (command) => {
        if (command.type === "toggle-tool") {
          toolCoordinator?.toggle(command.toolId);
        } else if (command.type === "dismiss-top-layer") {
          if (toolCoordinator?.activeTool() !== undefined)
            toolCoordinator.deactivate();
        } else if (command.type === "save-city") {
          void save();
        }
      },
    });

    inputController = createCityInputController({
      viewport: screen.viewport,
      camera,
      requestRender,
      toolPointerSink: interactionRouter.toolPointerSink,
      onTap: (clientX, clientY) =>
        interactionRouter?.onSemanticTap(clientX, clientY),
    });
    screen.element.dataset.inputController = "ready";
    screen.element.dataset.terrainSectors = String(
      projection.root.children.length,
    );
    updateDebugDiagnostics();
    updateTerraformDiagnostics();
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
      commandRouter?.dispose();
      interactionRouter?.dispose();
      toolCoordinator?.dispose();
      terraformPointerSession?.dispose();
      inputController?.dispose();
      terraformRuntime?.dispose();
      terraformOverlay?.setPreview(undefined);
      terraformOverlay?.dispose();
      debugOverlay?.dispose();
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
