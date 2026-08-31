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
import { createContextSurface } from "../ui/patterns/context-surface";
import { createToolDock } from "../ui/patterns/tool-dock";
import {
  createGameScreen,
  type GameScreenHandle,
} from "../ui/screens/create-game-screen";
import type { TerraformToolViewState } from "../ui/tools/terraform/terraform-tool-view-state";
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
} from "./game/create-game-tool-coordinator";
import {
  createGameUiCoordinator,
  type GameUiCoordinator,
} from "./game/create-game-ui-coordinator";
import {
  createTerraformGameTool,
  type TerraformGameTool,
} from "./game/create-terraform-game-tool";
import {
  createTerrainDebugPanel,
  type TerrainDebugPanelHandle,
} from "./game/create-terrain-debug-panel";

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
  let inputController: CityInputController | undefined;
  let toolCoordinator: GameToolCoordinator | undefined;
  let interactionRouter: GameInteractionRouter | undefined;
  let commandRouter: GameCommandRouter | undefined;
  let terraformTool: TerraformGameTool | undefined;
  let toolDock: ReturnType<typeof createToolDock> | undefined;
  let contextSurface: ReturnType<typeof createContextSurface> | undefined;
  let cameraController: ReturnType<typeof createCityCamera> | undefined;
  let pickStatus = "";
  let saving = false;

  const screen = createGameScreen();

  const updateTerraformDiagnostics = (
    state: TerraformToolViewState,
    active: boolean,
  ): void => {
    screen.element.dataset.terraformActive = String(active);
    screen.element.dataset.terraformOperation = state.operation;
    screen.element.dataset.terraformBrush = String(state.brushSize);
    screen.element.dataset.terraformStrength = state.strength;
    screen.element.dataset.terraformPreview =
      state.validity === "idle" ? "none" : state.validity;
    screen.element.dataset.terraformUndoDepth = String(state.undoDepth);
    screen.element.dataset.terrainRevision = String(
      input.session.terrain.read.revision(),
    );
  };

  const activeDebugLayers = (): readonly TerrainDebugLayer[] =>
    debugOverlay === undefined
      ? []
      : DEBUG_LAYER_ORDER.filter((layer) => debugOverlay?.visibility()[layer]);

  const updateDebugDiagnostics = (): void => {
    const layers = activeDebugLayers();
    screen.element.dataset.debugLayers = layers.join(",");
    debugPanel?.render(layers, pickStatus);
  };

  const writePick = (pick: TerrainPointerPickResult): void => {
    screen.element.dataset.pickStatus = pick.status;
    if (pick.status === "hit") {
      screen.element.dataset.pickCell = `${pick.value.cell.x},${pick.value.cell.z}`;
      pickStatus = `Cell ${pick.value.cell.x}, ${pick.value.cell.z}`;
    } else {
      delete screen.element.dataset.pickCell;
      pickStatus =
        pick.status === "miss"
          ? `No terrain hit: ${pick.reason}`
          : "Terrain unavailable";
    }
    updateDebugDiagnostics();
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
    screen.setBusy(true);
    gameUi?.setBusy(true);
    try {
      const result = await input.onSave();
      if (result.status === "success") gameUi?.notifySaveSuccess();
      else gameUi?.notifySaveFailure(result.message);
    } finally {
      saving = false;
      screen.setBusy(false);
      gameUi?.setBusy(false);
    }
  };

  const onDebugChange = (layer: TerrainDebugLayer, checked: boolean): void => {
    if (debugOverlay === undefined || disposed) return;
    const next: Partial<TerrainDebugVisibility> = { [layer]: checked };
    debugOverlay.setVisibility(next);
    updateDebugDiagnostics();
    requestRender();
  };

  const clearDebug = (): void => {
    if (debugOverlay === undefined || disposed) return;
    debugOverlay.setVisibility(
      Object.fromEntries(DEBUG_LAYER_ORDER.map((layer) => [layer, false])),
    );
    updateDebugDiagnostics();
    requestRender();
  };

  const inactiveContextContent = document.createElement("div");
  const syncToolUi = (): void => {
    const coordinator = toolCoordinator;
    const terrain = terraformTool;
    const dock = toolDock;
    const context = contextSurface;
    if (
      coordinator === undefined ||
      terrain === undefined ||
      dock === undefined ||
      context === undefined
    ) {
      screen.setActiveTool(undefined);
      return;
    }
    const active = coordinator.activeTool();
    const activeToolId = coordinator.activeToolId();
    screen.setActiveTool(activeToolId);
    dock.render({
      tools: [
        {
          descriptor: terrain.descriptor,
          availability: terrain.availability(),
        },
      ],
      ...(activeToolId === undefined ? {} : { activeToolId }),
    });
    if (active === undefined) {
      context.render({
        open: false,
        label: "Tools",
        mode: "compact",
        content: inactiveContextContent,
      });
      return;
    }
    context.render({
      open: true,
      label: `${active.descriptor.label} tools`,
      mode: "compact",
      content: active.view.element,
    });
  };

  input.mount.replaceChildren(screen.element);
  input.mount.dataset.liveRuntime = "booting";
  screen.setActiveTool(undefined);
  screen.element.dataset.terraformActive = "false";
  screen.element.dataset.terraformOperation = "raise";
  screen.element.dataset.terraformBrush = "1";
  screen.element.dataset.terraformStrength = "normal";
  screen.element.dataset.terraformPreview = "none";
  screen.element.dataset.terraformUndoDepth = "0";
  screen.element.dataset.terrainRevision = String(
    input.session.terrain.read.revision(),
  );
  screen.element.dataset.terraformOverlayRoots = "0";

  const debugPanel: TerrainDebugPanelHandle = createTerrainDebugPanel({
    onDebugChange,
    onClearDebug: clearDebug,
  });
  debugPanel.render([], "");
  const gameUi: GameUiCoordinator = createGameUiCoordinator({
    cityName: input.session.metadata.name,
    hudHost: screen.hudHost,
    inspectorHost: screen.inspectorHost,
    dialogHost: screen.dialogHost,
    notificationHost: screen.notificationHost,
    debugHost: screen.debugHost,
    worldUnderlay: screen.viewport,
    debugContent: debugPanel.element,
    hasActiveTool: () => toolCoordinator?.activeTool() !== undefined,
    deactivateActiveTool: () => {
      toolCoordinator?.deactivate();
      syncToolUi();
    },
    onSave: () => void save(),
    onExit: input.onExit,
  });

  const scene = createScene(screen.viewport, createCitySceneCameraConfig(map));
  if (!scene.available) {
    pickStatus = "WebGL unavailable";
    updateDebugDiagnostics();
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

    const camera = createCityCamera({ camera: scene.camera, map });
    cameraController = camera;
    const picker = createTerrainPointerPicker({
      viewport: screen.viewport,
      camera: scene.camera,
      projection,
    });

    terraformTool = createTerraformGameTool({
      session: input.session,
      projection,
      debugOverlay,
      pickClientPoint: (clientX, clientY) =>
        picker.pickClientPoint(clientX, clientY),
      onPick: writePick,
      requestRender,
      onStateChange: updateTerraformDiagnostics,
    });
    scene.scene.add(
      projection.root,
      debugOverlay.root,
      terraformTool.overlay.root,
    );
    screen.element.dataset.terraformOverlayRoots = String(
      scene.scene.children.filter(
        (child) => child.name === "terraform-three-overlay",
      ).length,
    );

    toolCoordinator = createGameToolCoordinator([terraformTool]);
    toolDock = createToolDock({
      onToolPress: (toolId) => {
        toolCoordinator?.toggle(toolId);
        syncToolUi();
      },
    });
    contextSurface = createContextSurface({
      onDismiss: () => {
        toolCoordinator?.deactivate();
        syncToolUi();
      },
    });
    screen.toolDockHost.append(toolDock.element);
    screen.contextHost.append(contextSurface.element);
    syncToolUi();

    interactionRouter = createGameInteractionRouter({
      toolCoordinator,
      onSelectionTap: (clientX, clientY) =>
        writePick(picker.pickClientPoint(clientX, clientY)),
    });
    commandRouter = createGameCommandRouter({
      toolShortcuts: [{ toolId: "terrain", key: "t" }],
      onCommand: (command) => {
        if (command.type === "toggle-tool") {
          toolCoordinator?.toggle(command.toolId);
          syncToolUi();
        } else if (command.type === "dismiss-top-layer") {
          gameUi?.dismissTopLayer();
        } else if (command.type === "open-game-menu") {
          gameUi?.openGameMenu();
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
    requestRender();
    const rect = screen.viewport.getBoundingClientRect();
    writePick(
      picker.pickClientPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      ),
    );
    input.mount.dataset.liveRuntime = "ready";
  }

  return Object.freeze({
    dispose(): void {
      if (disposed) return;
      disposed = true;
      commandRouter?.dispose();
      inputController?.dispose();
      interactionRouter?.dispose();
      toolCoordinator?.dispose();
      contextSurface?.dispose();
      toolDock?.dispose();
      gameUi?.dispose();
      debugPanel?.dispose();
      debugOverlay?.dispose();
      liveProjection?.dispose();
      lighting?.dispose();
      scene.dispose();
      screen.dispose();
      screen.element.remove();
      input.mount.dataset.liveRuntime = "disposed";
    },
  });
}
